#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { SEOGenerator } from '../services/seo/seo-generator';
import { StructuredDataGenerator } from '../services/seo/structured-data-generator';
import { SocialMetaGenerator } from '../services/seo/social-meta-generator';
import { ContentOptimizer } from '../services/seo/content-optimizer';
import { URLGenerator } from '../utils/url-generator';
import { WeatherService } from '../services/weather/weather-service';
import { OSMService } from '../services/osm/osm-service';
import type { AutomatedCourseDetails, WeatherData } from '../types/quality.types';
import type { SEOConfiguration, GeneratedCoursePage, CoursePageProps, POI } from '../types/seo.types';
import logger from '../utils/logger';

/**
 * Page Generation Script
 *
 * Generates SEO-optimized static course detail pages for all golf courses in the database.
 * Creates JSON files with pre-computed SEO metadata and course data for Next.js static generation.
 */

const prisma = new PrismaClient();

// SEO Configuration
const seoConfig: SEOConfiguration = {
  siteName: 'Golf Journey Map',
  siteUrl: process.env.SITE_URL || 'https://golfjourney.com',
  defaultTitle: 'Golf Journey Map - Discover Premier Golf Courses',
  defaultDescription: 'Explore the world\'s finest golf courses with detailed information, weather conditions, and booking options.',
  defaultKeywords: ['golf', 'golf courses', 'tee times', 'golf booking', 'golf vacation'],
  socialHandles: {
    twitter: '@golfjourneymap',
    facebook: 'golfjourneymap',
    instagram: 'golfjourneymap'
  },
  analytics: {
    googleAnalytics: process.env.GA_TRACKING_ID,
    googleTagManager: process.env.GTM_ID
  },
  structuredData: {
    organization: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Golf Journey Map',
      url: process.env.SITE_URL || 'https://golfjourney.com',
      logo: `${process.env.SITE_URL || 'https://golfjourney.com'}/images/logo.png`,
      sameAs: [
        'https://twitter.com/golfjourneymap',
        'https://facebook.com/golfjourneymap',
        'https://instagram.com/golfjourneymap'
      ]
    }
  }
};

interface GenerationOptions {
  limit?: number;
  force?: boolean;
  courseId?: string;
  courseIds?: string[];
  state?: string;
  outputDir?: string;
  validateSEO?: boolean;
  skipWeather?: boolean;
  skipAmenities?: boolean;
  dryRun?: boolean;
}

interface GenerationStats {
  totalCourses: number;
  generatedPages: number;
  skippedPages: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

class PageGenerator {
  private seoGenerator: SEOGenerator;
  private structuredDataGenerator: StructuredDataGenerator;
  private socialMetaGenerator: SocialMetaGenerator;
  private contentOptimizer: ContentOptimizer;
  private urlGenerator: URLGenerator;
  private weatherService: WeatherService;
  private osmService: OSMService;
  private outputDir: string;
  private stats: GenerationStats;

  constructor(options: GenerationOptions = {}) {
    this.seoGenerator = new SEOGenerator(seoConfig);
    this.structuredDataGenerator = new StructuredDataGenerator(seoConfig);
    this.socialMetaGenerator = new SocialMetaGenerator(seoConfig);
    this.contentOptimizer = new ContentOptimizer();
    this.urlGenerator = new URLGenerator(seoConfig.siteUrl);
    this.weatherService = new WeatherService();
    this.osmService = new OSMService();
    this.outputDir = options.outputDir || path.join(process.cwd(), 'generated-pages');
    this.stats = {
      totalCourses: 0,
      generatedPages: 0,
      skippedPages: 0,
      errors: 0,
      startTime: new Date()
    };
  }

  /**
   * Generate pages for all golf courses
   */
  async generateAllPages(options: GenerationOptions = {}): Promise<GenerationStats> {
    try {
      logger.info('Starting course page generation', options);

      // Create output directory
      await this.ensureOutputDirectory();

      // Fetch courses from database
      const courses = await this.fetchCourses(options);
      this.stats.totalCourses = courses.length;

      logger.info(`Found ${courses.length} courses to process`);

      // Generate pages in batches to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < courses.length; i += batchSize) {
        const batch = courses.slice(i, i + batchSize);
        await this.generateBatch(batch, options);

        // Log progress
        const progress = Math.round(((i + batch.length) / courses.length) * 100);
        logger.info(`Progress: ${progress}% (${i + batch.length}/${courses.length})`);
      }

      // Generate index files
      await this.generateIndexFiles(courses);

      // Finalize stats
      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();

      logger.info('Page generation completed', this.stats);
      return this.stats;

    } catch (error) {
      logger.error('Error during page generation', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Generate a single course page
   */
  async generateCoursePage(courseId: string): Promise<GeneratedCoursePage | null> {
    try {
      const course = await this.fetchCourseById(courseId);
      if (!course) {
        logger.warn(`Course not found: ${courseId}`);
        return null;
      }

      return await this.generateSinglePage(course, { validateSEO: true });

    } catch (error) {
      logger.error('Error generating course page', {
        courseId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Fetch courses from database based on options
   */
  private async fetchCourses(options: GenerationOptions): Promise<AutomatedCourseDetails[]> {
    const whereClause: any = {};

    if (options.courseId) {
      whereClause.id = options.courseId;
    }

    if (options.courseIds) {
      whereClause.id = { in: options.courseIds };
    }

    if (options.state) {
      whereClause.location = {
        contains: options.state,
        mode: 'insensitive'
      };
    }

    const courses = await prisma.automatedCourseDetails.findMany({
      where: whereClause,
      take: options.limit,
      orderBy: { name: 'asc' },
      include: {
        galleryImages: true,
        userReviews: true,
      }
    });

    // Return courses with proper typing and included relations
    return courses.map(course => ({
      ...course,
      galleryImages: course.galleryImages || [],
      userReviews: course.userReviews || []
    }));
  }

  /**
   * Fetch single course by ID
   */
  private async fetchCourseById(courseId: string): Promise<AutomatedCourseDetails | null> {
    const course = await prisma.automatedCourseDetails.findUnique({
      where: { id: courseId },
      include: {
        galleryImages: true,
        userReviews: true,
      }
    });

    if (!course) return null;

    return {
      ...course,
      galleryImages: course.galleryImages || [],
      userReviews: course.userReviews || []
    };
  }

  /**
   * Generate a batch of course pages
   */
  private async generateBatch(
    courses: AutomatedCourseDetails[],
    options: GenerationOptions
  ): Promise<void> {
    const promises = courses.map(course => this.generateSinglePage(course, options));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value) {
          this.stats.generatedPages++;
        } else {
          this.stats.skippedPages++;
        }
      } else {
        this.stats.errors++;
        logger.error('Error generating page for course', {
          courseId: courses[index].id,
          courseName: courses[index].name,
          error: result.reason
        });
      }
    });
  }

  /**
   * Generate a single course page
   */
  private async generateSinglePage(
    course: AutomatedCourseDetails,
    options: GenerationOptions
  ): Promise<GeneratedCoursePage | null> {
    try {
      const startTime = Date.now();

      logger.debug('Generating page for course', {
        courseId: course.id,
        courseName: course.name
      });

      // Generate all required data in parallel
      const [
        seoMetadata,
        optimizedContent,
        weatherData,
        nearbyAmenities
      ] = await Promise.all([
        this.generateSEOMetadata(course),
        this.generateOptimizedContent(course),
        options.skipWeather ? null : this.fetchWeatherData(course),
        options.skipAmenities ? [] : this.fetchNearbyAmenities(course)
      ]);

      // Validate SEO if requested
      if (options.validateSEO && !this.seoGenerator.validateSEOMetadata(seoMetadata)) {
        logger.warn('SEO validation failed for course', {
          courseId: course.id,
          courseName: course.name
        });
      }

      // Generate social media tags
      const socialMetaTags = this.socialMetaGenerator.generateSocialTags(course, seoMetadata);

      // Create course page props
      const props: CoursePageProps = {
        courseData: course,
        weatherData: weatherData || undefined,
        nearbyAmenities,
        seoMetadata,
        optimizedContent,
        socialMetaTags
      };

      // Generate file path
      const slug = this.urlGenerator.generateCourseURL(course);
      const fileName = `${course.id}.json`;
      const filePath = path.join(this.outputDir, 'courses', fileName);

      // Create course directory if it doesn't exist
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Create generated page object
      const generatedPage: GeneratedCoursePage = {
        slug,
        filePath,
        props,
        metadata: seoMetadata,
        performance: {
          generationTime: Date.now() - startTime,
          fileSize: 0, // Will be calculated after writing
          imageCount: course.galleryImages.length + (course.heroImageUrl ? 1 : 0)
        }
      };

      // Write page data to file
      const jsonContent = JSON.stringify(generatedPage, null, 2);
      await fs.writeFile(filePath, jsonContent, 'utf8');

      // Calculate file size
      const stats = await fs.stat(filePath);
      generatedPage.performance.fileSize = stats.size;

      logger.debug('Generated course page', {
        courseId: course.id,
        courseName: course.name,
        filePath,
        fileSize: generatedPage.performance.fileSize,
        generationTime: generatedPage.performance.generationTime
      });

      return generatedPage;

    } catch (error) {
      logger.error('Error generating single page', {
        courseId: course.id,
        courseName: course.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Generate SEO metadata for a course
   */
  private async generateSEOMetadata(course: AutomatedCourseDetails) {
    try {
      return this.seoGenerator.generateCoursePageSEO(course);
    } catch (error) {
      logger.error('Error generating SEO metadata', {
        courseId: course.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return fallback SEO metadata
      return {
        title: `${course.name} - Golf Course`,
        description: `Golf course information for ${course.name}`,
        keywords: ['golf course', 'golf', course.name.toLowerCase()],
        canonicalUrl: `${seoConfig.siteUrl}/courses/${course.id}`,
        breadcrumbs: [],
        structuredData: this.structuredDataGenerator.generateCourseStructuredData(course)
      };
    }
  }

  /**
   * Generate optimized content for a course
   */
  private async generateOptimizedContent(course: AutomatedCourseDetails) {
    try {
      return this.contentOptimizer.optimizeContentForSEO(course, {
        includeWeather: true,
        includeHistory: true,
        includeNearbyAmenities: true,
        optimizeForKeywords: true,
        generateAltText: true,
        minContentLength: 300,
        maxContentLength: 1500
      });
    } catch (error) {
      logger.error('Error generating optimized content', {
        courseId: course.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return fallback content
      return {
        heroSection: {
          headline: course.name,
          subheadline: `Golf course in ${course.location}`,
          callToAction: 'Learn More',
          weatherWidget: false,
          keyHighlights: []
        },
        aboutSection: {
          description: course.description || `${course.name} is a golf course.`,
          quickFacts: [],
          highlights: []
        },
        historySection: {
          summary: '',
          timeline: [],
          notableEvents: []
        },
        featuresSection: {
          overview: 'Course features available.',
          specifications: [],
          amenities: []
        },
        locationSection: {
          summary: `Located in ${course.location}.`,
          nearbyAttractions: [],
          directions: {
            address: course.location,
            coordinates: [course.longitude || 0, course.latitude || 0]
          }
        }
      };
    }
  }

  /**
   * Fetch weather data for a course
   */
  private async fetchWeatherData(course: AutomatedCourseDetails): Promise<WeatherData | null> {
    try {
      if (!course.latitude || !course.longitude) {
        logger.warn('No coordinates available for weather data', { courseId: course.id });
        return null;
      }

      return await this.weatherService.getCurrentWeather(course.latitude, course.longitude);
    } catch (error) {
      logger.error('Error fetching weather data', {
        courseId: course.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Fetch nearby amenities for a course
   */
  private async fetchNearbyAmenities(course: AutomatedCourseDetails): Promise<POI[]> {
    try {
      if (!course.latitude || !course.longitude) {
        logger.warn('No coordinates available for amenities data', { courseId: course.id });
        return [];
      }

      const amenities = await this.osmService.getNearbyPOIs(
        course.latitude,
        course.longitude,
        5000 // 5km radius
      );

      // Convert OSM POIs to our POI format
      return amenities.map((amenity): POI => ({
        id: amenity.id,
        name: amenity.name,
        type: this.mapOSMTypeToAmenityType(amenity.type),
        distance: amenity.distance,
        coordinates: [amenity.longitude, amenity.latitude],
        address: amenity.address,
        rating: amenity.rating,
        description: amenity.description
      }));

    } catch (error) {
      logger.error('Error fetching nearby amenities', {
        courseId: course.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Map OSM types to our amenity types
   */
  private mapOSMTypeToAmenityType(osmType: string): POI['type'] {
    const typeMapping: Record<string, POI['type']> = {
      'restaurant': 'restaurant',
      'hotel': 'hotel',
      'attraction': 'attraction',
      'shop': 'shopping',
      'fuel': 'gas_station',
      'hospital': 'hospital'
    };

    return typeMapping[osmType] || 'attraction';
  }

  /**
   * Generate index files for state and city pages
   */
  private async generateIndexFiles(courses: AutomatedCourseDetails[]): Promise<void> {
    try {
      // Group courses by state and city
      const locationIndex = this.groupCoursesByLocation(courses);

      // Generate state index
      const stateIndexPath = path.join(this.outputDir, 'states.json');
      await fs.writeFile(stateIndexPath, JSON.stringify(locationIndex, null, 2));

      // Generate sitemap URLs
      const sitemapUrls = this.urlGenerator.generateSitemapURLs(courses);
      const sitemapPath = path.join(this.outputDir, 'sitemap-urls.json');
      await fs.writeFile(sitemapPath, JSON.stringify(sitemapUrls, null, 2));

      logger.info('Generated index files', {
        stateIndexPath,
        sitemapPath,
        stateCount: Object.keys(locationIndex).length,
        sitemapUrlCount: sitemapUrls.length
      });

    } catch (error) {
      logger.error('Error generating index files', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Group courses by location for index generation
   */
  private groupCoursesByLocation(courses: AutomatedCourseDetails[]): Record<string, any> {
    const locationIndex: Record<string, any> = {};

    courses.forEach(course => {
      const parts = course.location.split(',').map(part => part.trim());
      const city = parts[0] || 'Unknown';
      const state = parts[1] || 'Unknown';

      if (!locationIndex[state]) {
        locationIndex[state] = {
          name: state,
          cities: {},
          courseCount: 0
        };
      }

      if (!locationIndex[state].cities[city]) {
        locationIndex[state].cities[city] = {
          name: city,
          courses: [],
          courseCount: 0
        };
      }

      locationIndex[state].cities[city].courses.push({
        id: course.id,
        name: course.name,
        slug: this.urlGenerator.generateCourseURL(course)
      });

      locationIndex[state].cities[city].courseCount++;
      locationIndex[state].courseCount++;
    });

    return locationIndex;
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'courses'), { recursive: true });
  }
}

// CLI Script Execution
async function main() {
  const args = process.argv.slice(2);
  const options: GenerationOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case '--limit':
        options.limit = parseInt(value, 10);
        break;
      case '--course-id':
        options.courseId = value;
        break;
      case '--state':
        options.state = value;
        break;
      case '--output':
        options.outputDir = value;
        break;
      case '--force':
        options.force = true;
        i--; // No value for this flag
        break;
      case '--validate-seo':
        options.validateSEO = true;
        i--; // No value for this flag
        break;
    }
  }

  try {
    const generator = new PageGenerator(options);

    if (options.courseId) {
      // Generate single course page
      const result = await generator.generateCoursePage(options.courseId);
      if (result) {
        console.log(`✅ Generated page for course: ${options.courseId}`);
        console.log(`   File: ${result.filePath}`);
        console.log(`   Size: ${result.performance.fileSize} bytes`);
        console.log(`   Time: ${result.performance.generationTime}ms`);
      } else {
        console.log(`❌ Failed to generate page for course: ${options.courseId}`);
        process.exit(1);
      }
    } else {
      // Generate all pages
      const stats = await generator.generateAllPages(options);
      console.log(`\n✅ Page generation completed!`);
      console.log(`   Total courses: ${stats.totalCourses}`);
      console.log(`   Generated pages: ${stats.generatedPages}`);
      console.log(`   Skipped pages: ${stats.skippedPages}`);
      console.log(`   Errors: ${stats.errors}`);
      console.log(`   Duration: ${stats.duration}ms`);

      if (stats.errors > 0) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('❌ Page generation failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { PageGenerator };
export default main;