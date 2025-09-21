import type { AutomatedCourseDetails } from '../../types/quality.types';
import type { OptimizedContent } from './content-optimizer';
import { generateSocialMetaTags } from './social-meta-generator';
import { generateStructuredData } from './structured-data-generator';
import { generateUrlSlug } from '../../utils/url-generator';
import logger from '../../utils/logger';

/**
 * SEO Metadata Interface
 */
export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  robots: string;
  openGraph: {
    title: string;
    description: string;
    type: string;
    url: string;
    image?: string;
    siteName: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    image?: string;
  };
  structuredData: any;
  alternateUrls?: {
    [key: string]: string;
  };
  lastModified: string;
}

/**
 * SEO Configuration Options
 */
export interface SEOConfig {
  baseUrl: string;
  siteName: string;
  defaultImage?: string;
  twitterHandle?: string;
  maxTitleLength: number;
  maxDescriptionLength: number;
  includeStateInTitle: boolean;
  brandSuffix?: string;
}

/**
 * Default SEO Configuration
 */
const DEFAULT_SEO_CONFIG: SEOConfig = {
  baseUrl: 'https://golfjourney.com',
  siteName: 'Golf Journey Map',
  maxTitleLength: 60,
  maxDescriptionLength: 160,
  includeStateInTitle: true,
  brandSuffix: 'Golf Journey Map'
};

/**
 * Generate comprehensive SEO metadata for golf course pages
 */
export async function generateSEOMetadata(
  courseData: AutomatedCourseDetails,
  optimizedContent: OptimizedContent,
  weatherData?: any,
  nearbyAmenities?: any[],
  config: Partial<SEOConfig> = {}
): Promise<SEOMetadata> {
  const finalConfig = { ...DEFAULT_SEO_CONFIG, ...config };

  try {
    // Generate URL slug for the course
    const urlSlug = generateUrlSlug(courseData.name, courseData.location);
    const courseUrl = `${finalConfig.baseUrl}/courses/${urlSlug}`;

    // Generate optimized title
    const title = generateOptimizedTitle(courseData, optimizedContent, finalConfig);

    // Generate optimized description
    const description = generateOptimizedDescription(courseData, optimizedContent, finalConfig);

    // Generate keywords
    const keywords = generateKeywords(courseData, optimizedContent, nearbyAmenities);

    // Generate social media meta tags
    const socialMetaTags = generateSocialMetaTags(courseData, {
      title,
      description,
      url: courseUrl,
      image: getHeroImage(courseData),
      siteName: finalConfig.siteName,
      twitterHandle: finalConfig.twitterHandle
    });

    // Generate structured data
    const structuredData = generateStructuredData(courseData, weatherData);

    // Generate robots directive
    const robots = generateRobotsDirective(courseData);

    logger.info('Generated SEO metadata', {
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
      canonical: courseUrl,
      robots,
      openGraph: socialMetaTags.openGraph,
      twitter: socialMetaTags.twitter,
      structuredData,
      lastModified: courseData.updatedAt.toISOString()
    };

  } catch (error) {
    logger.error('Error generating SEO metadata', {
      courseId: courseData.id,
      courseName: courseData.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Return fallback metadata
    return generateFallbackMetadata(courseData, finalConfig);
  }
}

/**
 * Generate optimized title tag
 */
function generateOptimizedTitle(
  courseData: AutomatedCourseDetails,
  optimizedContent: OptimizedContent,
  config: SEOConfig
): string {
  const courseName = courseData.name;
  const location = extractLocationParts(courseData.location);

  let title = courseName;

  // Add location if configured
  if (config.includeStateInTitle && location.state) {
    title += ` - ${location.city}, ${location.state}`;
  }

  // Add course type if notable
  if (courseData.difficulty === 'Championship' || courseData.courseType === 'Private') {
    const typeDescriptor = courseData.difficulty === 'Championship' ? 'Championship' :
                          courseData.courseType === 'Private' ? 'Private' : '';
    if (typeDescriptor && title.length + typeDescriptor.length + 3 <= config.maxTitleLength) {
      title += ` | ${typeDescriptor}`;
    }
  }

  // Add brand suffix if there's room
  if (config.brandSuffix && title.length + config.brandSuffix.length + 3 <= config.maxTitleLength) {
    title += ` | ${config.brandSuffix}`;
  }

  // Ensure title doesn't exceed max length
  if (title.length > config.maxTitleLength) {
    const maxLength = config.maxTitleLength - 3; // Account for ellipsis
    title = title.substring(0, maxLength) + '...';
  }

  return title;
}

/**
 * Generate optimized meta description
 */
function generateOptimizedDescription(
  courseData: AutomatedCourseDetails,
  optimizedContent: OptimizedContent,
  config: SEOConfig
): string {
  const courseName = courseData.name;
  const location = extractLocationParts(courseData.location);

  let description = '';

  // Start with base description
  if (courseData.description && courseData.description.length > 50) {
    description = courseData.description;
  } else {
    // Generate description from course details
    description = `${courseName} is a`;

    if (courseData.difficulty) {
      description += ` ${courseData.difficulty.toLowerCase()}`;
    }

    description += ` golf course located in ${location.city || 'unknown'}, ${location.state || 'unknown'}.`;

    // Add notable features
    const features = [];
    if (courseData.numberOfHoles && courseData.numberOfHoles !== 18) {
      features.push(`${courseData.numberOfHoles}-hole course`);
    }
    if (courseData.par) {
      features.push(`par ${courseData.par}`);
    }
    if (courseData.architect) {
      features.push(`designed by ${courseData.architect}`);
    }

    if (features.length > 0) {
      description += ` Features include ${features.join(', ')}.`;
    }
  }

  // Add pricing info if available
  if (courseData.greensFeePriceRange && !description.toLowerCase().includes('price')) {
    description += ` Greens fees: ${courseData.greensFeePriceRange}.`;
  }

  // Add booking CTA if available
  if (courseData.teeTimeBookingUrl) {
    description += ' Book your tee time today.';
  }

  // Ensure description doesn't exceed max length
  if (description.length > config.maxDescriptionLength) {
    const maxLength = config.maxDescriptionLength - 3; // Account for ellipsis
    description = description.substring(0, maxLength) + '...';
  }

  return description.trim();
}

/**
 * Generate SEO keywords array
 */
function generateKeywords(
  courseData: AutomatedCourseDetails,
  optimizedContent: OptimizedContent,
  nearbyAmenities?: any[]
): string[] {
  const keywords = new Set<string>();

  // Core golf keywords
  keywords.add('golf course');
  keywords.add('golf');
  keywords.add('tee times');
  keywords.add('greens fees');

  // Course name and location
  keywords.add(courseData.name.toLowerCase());
  const location = extractLocationParts(courseData.location);
  if (location.city) keywords.add(location.city.toLowerCase());
  if (location.state) keywords.add(location.state.toLowerCase());

  // Course type and difficulty
  if (courseData.courseType) keywords.add(courseData.courseType.toLowerCase());
  if (courseData.difficulty) keywords.add(courseData.difficulty.toLowerCase());

  // Course features
  if (courseData.numberOfHoles && courseData.numberOfHoles !== 18) {
    keywords.add(`${courseData.numberOfHoles} hole`);
  }
  if (courseData.architect) {
    keywords.add(courseData.architect.toLowerCase());
  }

  // Amenities
  if (courseData.drivingRange) keywords.add('driving range');
  if (courseData.puttingGreen) keywords.add('putting green');
  if (courseData.proShop) keywords.add('pro shop');
  if (courseData.restaurant) keywords.add('golf restaurant');

  // Access type
  if (courseData.publicAccess !== undefined) {
    keywords.add(courseData.publicAccess ? 'public golf' : 'private golf');
  }

  // Nearby amenities
  if (nearbyAmenities && nearbyAmenities.length > 0) {
    nearbyAmenities.forEach(amenity => {
      if (amenity.type === 'Hotel') keywords.add('golf resort');
      if (amenity.type === 'Restaurant') keywords.add('golf dining');
    });
  }

  // Long-tail keywords
  keywords.add(`${courseData.name.toLowerCase()} golf course`);
  keywords.add(`${location.city?.toLowerCase() || ''} golf`);
  keywords.add(`golf courses ${location.state?.toLowerCase() || ''}`);

  return Array.from(keywords).filter(keyword => keyword.length > 1);
}

/**
 * Generate robots directive
 */
function generateRobotsDirective(courseData: AutomatedCourseDetails): string {
  // Allow indexing for high-quality courses
  if (courseData.qualityScore >= 80) {
    return 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
  }

  // Limited indexing for lower quality courses
  if (courseData.qualityScore >= 60) {
    return 'index, follow, max-snippet:160, max-image-preview:standard';
  }

  // No indexing for very low quality courses
  return 'noindex, nofollow';
}

/**
 * Extract location parts from location string
 */
function extractLocationParts(location: string): { city?: string; state?: string; zip?: string } {
  const parts = location.split(',').map(part => part.trim());

  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})?/);

    return {
      city: parts[parts.length - 2],
      state: stateZipMatch ? stateZipMatch[1] : undefined,
      zip: stateZipMatch ? stateZipMatch[2] : undefined
    };
  }

  return {};
}

/**
 * Get hero image URL for the course
 */
function getHeroImage(courseData: AutomatedCourseDetails): string | undefined {
  // This would typically come from the media system
  // For now, return a placeholder or default image
  return `/media/courses/${courseData.id}/optimized/hero/main.webp`;
}

/**
 * Generate fallback metadata when main generation fails
 */
function generateFallbackMetadata(courseData: AutomatedCourseDetails, config: SEOConfig): SEOMetadata {
  const urlSlug = generateUrlSlug(courseData.name, courseData.location);
  const courseUrl = `${config.baseUrl}/courses/${urlSlug}`;

  return {
    title: `${courseData.name} | ${config.brandSuffix}`,
    description: `${courseData.name} golf course information including location, contact details, and course features.`,
    keywords: ['golf course', 'golf', courseData.name.toLowerCase()],
    canonical: courseUrl,
    robots: 'index, follow',
    openGraph: {
      title: courseData.name,
      description: `Golf course information for ${courseData.name}`,
      type: 'website',
      url: courseUrl,
      siteName: config.siteName
    },
    twitter: {
      card: 'summary',
      title: courseData.name,
      description: `Golf course information for ${courseData.name}`
    },
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'GolfCourse',
      name: courseData.name,
      description: courseData.description || `Golf course information for ${courseData.name}`
    },
    lastModified: courseData.updatedAt.toISOString()
  };
}

export {
  generateOptimizedTitle,
  generateOptimizedDescription,
  generateKeywords,
  generateRobotsDirective
};