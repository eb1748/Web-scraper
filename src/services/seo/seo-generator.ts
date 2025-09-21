import type { AutomatedCourseDetails } from '../../types/quality.types';
import type {
  SEOMetadata,
  Breadcrumb,
  SEOConfiguration,
  StructuredDataSchema
} from '../../types/seo.types';
import { URLGenerator } from '../../utils/url-generator';
import { StructuredDataGenerator } from './structured-data-generator';
import logger from '../../utils/logger';

/**
 * SEO Generator Service
 *
 * Generates comprehensive SEO metadata for golf course pages including:
 * - Optimized titles and descriptions
 * - Relevant keywords
 * - Canonical URLs
 * - Breadcrumb navigation
 * - Structured data markup
 */
export class SEOGenerator {
  private urlGenerator: URLGenerator;
  private structuredDataGenerator: StructuredDataGenerator;
  private config: SEOConfiguration;

  constructor(config: SEOConfiguration) {
    this.config = config;
    this.urlGenerator = new URLGenerator(config.siteUrl);
    this.structuredDataGenerator = new StructuredDataGenerator(config);
  }

  /**
   * Generate complete SEO metadata for a golf course page
   */
  generateCoursePageSEO(courseData: AutomatedCourseDetails): SEOMetadata {
    try {
      const title = this.generateTitle(courseData);
      const description = this.generateDescription(courseData);
      const keywords = this.generateKeywords(courseData);
      const canonicalUrl = this.urlGenerator.generateCanonicalURL(courseData);
      const breadcrumbs = this.generateBreadcrumbs(courseData);
      const structuredData = this.structuredDataGenerator.generateCourseStructuredData(courseData);

      logger.debug('Generated SEO metadata for course', {
        courseId: courseData.id,
        courseName: courseData.name,
        titleLength: title.length,
        descriptionLength: description.length,
        keywordCount: keywords.length
      });

      return {
        title,
        description,
        keywords,
        canonicalUrl,
        breadcrumbs,
        structuredData
      };
    } catch (error) {
      logger.error('Error generating SEO metadata', {
        courseId: courseData.id,
        courseName: courseData.name,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return fallback SEO metadata
      return this.generateFallbackSEO(courseData);
    }
  }

  /**
   * Generate SEO-optimized page title
   * Format: "Course Name - Location | Golf Course Guide"
   */
  private generateTitle(course: AutomatedCourseDetails): string {
    const location = this.extractCity(course.location);
    const baseName = course.name.replace(/golf course|golf club/gi, '').trim();

    let title = `${baseName} Golf Course - ${location}`;

    // Add unique selling points if available
    if (course.architect && this.isNotableArchitect(course.architect)) {
      title += ` | ${course.architect} Design`;
    } else if (course.majorChampionships && course.majorChampionships.length > 0) {
      const championship = course.majorChampionships[0];
      title += ` | ${championship} Host`;
    } else if (course.courseType) {
      title += ` | ${course.courseType} Course`;
    }

    // Ensure title doesn't exceed 60 characters for optimal SEO
    if (title.length > 60) {
      title = `${baseName} - ${location} | Golf Course`;
    }

    return title;
  }

  /**
   * Generate SEO-optimized meta description
   * Target: 150-160 characters for optimal search result display
   */
  private generateDescription(course: AutomatedCourseDetails): string {
    const location = this.extractCity(course.location);
    const state = this.extractState(course.location);
    const architect = course.architect ? ` designed by ${course.architect}` : '';
    const year = course.openingYear ? ` (${course.openingYear})` : '';

    let description = `${course.name} golf course in ${location}, ${state}${architect}${year}. `;

    // Add compelling features
    const features = [];

    if (course.majorChampionships && course.majorChampionships.length > 0) {
      features.push(`Host of ${course.majorChampionships[0]}`);
    }

    if (course.totalYardage) {
      features.push(`${course.totalYardage} yards`);
    }

    if (course.courseType) {
      features.push(`${course.courseType.toLowerCase()} layout`);
    }

    if (features.length > 0) {
      description += features.slice(0, 2).join(', ') + '. ';
    }

    // Add call to action
    description += 'Course details, weather, tee times & booking info.';

    // Ensure description fits within 160 characters
    if (description.length > 160) {
      // Truncate and add ellipsis
      description = description.substring(0, 157) + '...';
    }

    return description;
  }

  /**
   * Generate relevant keywords for the golf course
   */
  private generateKeywords(course: AutomatedCourseDetails): string[] {
    const keywords = new Set<string>();

    // Core golf keywords
    keywords.add('golf course');
    keywords.add('golf');
    keywords.add('tee times');
    keywords.add('golf booking');

    // Course-specific keywords
    const courseName = course.name.toLowerCase();
    keywords.add(courseName);

    // Location-based keywords
    const city = this.extractCity(course.location).toLowerCase();
    const state = this.extractState(course.location).toLowerCase();

    keywords.add(city);
    keywords.add(state);
    keywords.add(`${city} golf`);
    keywords.add(`${state} golf`);
    keywords.add(`golf ${city}`);
    keywords.add(`golf courses ${city}`);
    keywords.add(`golf courses ${state}`);

    // Architect keywords
    if (course.architect) {
      keywords.add(course.architect.toLowerCase());
      keywords.add(`${course.architect.toLowerCase()} golf course`);
    }

    // Course type keywords
    if (course.courseType) {
      const type = course.courseType.toLowerCase();
      keywords.add(type);
      keywords.add(`${type} golf course`);
    }

    // Championship keywords
    if (course.majorChampionships) {
      course.majorChampionships.forEach(championship => {
        keywords.add(championship.toLowerCase());
        keywords.add(`${championship.toLowerCase()} golf course`);
      });
    }

    // Notable events keywords
    if (course.notableEvents) {
      course.notableEvents.slice(0, 3).forEach(event => {
        keywords.add(event.toLowerCase());
      });
    }

    // Technical keywords
    if (course.totalYardage) {
      keywords.add(`${course.totalYardage} yard golf course`);
    }

    if (course.parScore) {
      keywords.add(`par ${course.parScore}`);
    }

    // Remove duplicates and return as array, limited to 15 keywords
    return Array.from(keywords).slice(0, 15);
  }

  /**
   * Generate breadcrumb navigation for SEO and UX
   */
  private generateBreadcrumbs(course: AutomatedCourseDetails): Breadcrumb[] {
    const city = this.extractCity(course.location);
    const state = this.extractState(course.location);

    return [
      {
        name: 'Home',
        url: this.config.siteUrl,
        position: 1
      },
      {
        name: 'Golf Courses',
        url: `${this.config.siteUrl}/courses`,
        position: 2
      },
      {
        name: state,
        url: this.urlGenerator.generateStatePageURL(state),
        position: 3
      },
      {
        name: city,
        url: this.urlGenerator.generateCityPageURL(state, city),
        position: 4
      },
      {
        name: course.name,
        url: this.urlGenerator.generateCanonicalURL(course),
        position: 5
      }
    ];
  }

  /**
   * Extract city from location string
   */
  private extractCity(location: string): string {
    // Handle various location formats: "City, State", "City, State, Country", etc.
    const parts = location.split(',').map(part => part.trim());
    return parts[0] || 'Unknown City';
  }

  /**
   * Extract state from location string
   */
  private extractState(location: string): string {
    const parts = location.split(',').map(part => part.trim());

    if (parts.length >= 2) {
      // Handle state abbreviations and full names
      const state = parts[1];
      return this.normalizeStateName(state);
    }

    return 'Unknown State';
  }

  /**
   * Normalize state names and abbreviations
   */
  private normalizeStateName(state: string): string {
    const stateMap: Record<string, string> = {
      'CA': 'California',
      'FL': 'Florida',
      'TX': 'Texas',
      'NY': 'New York',
      'AZ': 'Arizona',
      'NC': 'North Carolina',
      'SC': 'South Carolina',
      'GA': 'Georgia',
      'HI': 'Hawaii',
      'NV': 'Nevada',
      // Add more mappings as needed
    };

    return stateMap[state.toUpperCase()] || state;
  }

  /**
   * Check if architect is notable for SEO purposes
   */
  private isNotableArchitect(architect: string): boolean {
    const notableArchitects = [
      'jack nicklaus',
      'tiger woods',
      'tom fazio',
      'pete dye',
      'robert trent jones',
      'donald ross',
      'alister mackenzie',
      'tom watson',
      'arnold palmer',
      'greg norman',
      'ben crenshaw',
      'coore and crenshaw',
      'tom doak',
      'gil hanse'
    ];

    return notableArchitects.some(notable =>
      architect.toLowerCase().includes(notable)
    );
  }

  /**
   * Generate fallback SEO metadata in case of errors
   */
  private generateFallbackSEO(course: AutomatedCourseDetails): SEOMetadata {
    const location = this.extractCity(course.location);

    return {
      title: `${course.name} - ${location} | Golf Course Guide`,
      description: `${course.name} golf course in ${location}. Course information, tee times, and booking details.`,
      keywords: ['golf course', 'golf', course.name.toLowerCase(), location.toLowerCase()],
      canonicalUrl: `${this.config.siteUrl}/courses/${course.id}`,
      breadcrumbs: [
        { name: 'Home', url: this.config.siteUrl, position: 1 },
        { name: 'Golf Courses', url: `${this.config.siteUrl}/courses`, position: 2 },
        { name: course.name, url: `${this.config.siteUrl}/courses/${course.id}`, position: 3 }
      ],
      structuredData: this.structuredDataGenerator.generateCourseStructuredData(course)
    };
  }

  /**
   * Validate generated SEO metadata
   */
  validateSEOMetadata(seo: SEOMetadata): boolean {
    const issues = [];

    if (seo.title.length < 30 || seo.title.length > 60) {
      issues.push('Title should be between 30-60 characters');
    }

    if (seo.description.length < 120 || seo.description.length > 160) {
      issues.push('Description should be between 120-160 characters');
    }

    if (seo.keywords.length < 5 || seo.keywords.length > 15) {
      issues.push('Should have between 5-15 keywords');
    }

    if (!seo.canonicalUrl.startsWith('https://')) {
      issues.push('Canonical URL should use HTTPS');
    }

    if (issues.length > 0) {
      logger.warn('SEO validation issues found', { issues });
      return false;
    }

    return true;
  }
}