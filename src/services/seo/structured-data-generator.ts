import type { AutomatedCourseDetails } from '../../types/quality.types';
import type {
  StructuredDataSchema,
  GolfCourseSchema,
  BreadcrumbSchema,
  PostalAddress,
  GeoCoordinates,
  LocationFeatureSpecification,
  AggregateRating,
  ReserveAction,
  BreadcrumbItem,
  SEOConfiguration,
  Breadcrumb
} from '../../types/seo.types';
import logger from '../../utils/logger';

/**
 * Structured Data Generator Service
 *
 * Generates JSON-LD structured data markup for golf courses following schema.org standards.
 * This helps search engines understand and display rich snippets for course information.
 */
export class StructuredDataGenerator {
  private config: SEOConfiguration;

  constructor(config: SEOConfiguration) {
    this.config = config;
  }

  /**
   * Generate complete structured data for a golf course
   */
  generateCourseStructuredData(course: AutomatedCourseDetails): StructuredDataSchema {
    try {
      const golfCourse = this.generateGolfCourseSchema(course);
      const breadcrumb = this.generateBreadcrumbSchema(course);

      logger.debug('Generated structured data for course', {
        courseId: course.id,
        courseName: course.name,
        hasGolfCourse: !!golfCourse,
        hasBreadcrumb: !!breadcrumb
      });

      return {
        golfCourse,
        breadcrumb,
        organization: this.config.structuredData.organization
      };
    } catch (error) {
      logger.error('Error generating structured data', {
        courseId: course.id,
        courseName: course.name,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return minimal structured data
      return this.generateFallbackStructuredData(course);
    }
  }

  /**
   * Generate golf course schema markup
   */
  private generateGolfCourseSchema(course: AutomatedCourseDetails): GolfCourseSchema {
    const address = this.extractAddress(course.location);
    const geoCoordinates = this.generateGeoCoordinates(course);
    const amenityFeatures = this.generateAmenityFeatures(course);
    const aggregateRating = this.generateAggregateRating(course);
    const potentialAction = this.generateReserveAction(course);

    const schema: GolfCourseSchema = {
      '@context': 'https://schema.org',
      '@type': 'GolfCourse',
      name: course.name,
      address,
      geo: geoCoordinates,
      amenityFeature: amenityFeatures
    };

    // Add optional properties if available
    if (course.description) {
      schema.description = this.sanitizeDescription(course.description);
    }

    if (course.phoneNumber) {
      schema.telephone = course.phoneNumber;
    }

    if (course.website) {
      schema.url = course.website;
    }

    if (course.heroImageUrl) {
      schema.image = course.heroImageUrl;
    }

    if (course.architect) {
      schema.architect = course.architect;
    }

    if (course.openingYear) {
      schema.dateOpened = `${course.openingYear}-01-01`;
    }

    if (course.greensFeePriceRange) {
      schema.priceRange = course.greensFeePriceRange;
    }

    if (aggregateRating) {
      schema.aggregateRating = aggregateRating;
    }

    if (potentialAction) {
      schema.potentialAction = potentialAction;
    }

    return schema;
  }

  /**
   * Generate breadcrumb schema markup
   */
  generateBreadcrumbSchema(course: AutomatedCourseDetails): BreadcrumbSchema {
    const breadcrumbItems = this.generateBreadcrumbItems(course);

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems
    };
  }

  /**
   * Generate breadcrumb items from course data
   */
  private generateBreadcrumbItems(course: AutomatedCourseDetails): BreadcrumbItem[] {
    const city = this.extractCity(course.location);
    const state = this.extractState(course.location);

    const items: BreadcrumbItem[] = [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: this.config.siteUrl
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Golf Courses',
        item: `${this.config.siteUrl}/courses`
      }
    ];

    if (state) {
      items.push({
        '@type': 'ListItem',
        position: 3,
        name: state,
        item: `${this.config.siteUrl}/courses/${this.slugify(state)}`
      });
    }

    if (city) {
      items.push({
        '@type': 'ListItem',
        position: items.length + 1,
        name: city,
        item: `${this.config.siteUrl}/courses/${this.slugify(state)}/${this.slugify(city)}`
      });
    }

    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: course.name,
      item: `${this.config.siteUrl}/courses/${course.id}`
    });

    return items;
  }

  /**
   * Extract and format postal address
   */
  private extractAddress(location: string): PostalAddress {
    const parts = location.split(',').map(part => part.trim());

    let addressLocality = 'Unknown City';
    let addressRegion = 'Unknown State';
    const addressCountry = 'US';

    if (parts.length >= 1) {
      addressLocality = parts[0];
    }

    if (parts.length >= 2) {
      addressRegion = this.normalizeStateName(parts[1]);
    }

    return {
      '@type': 'PostalAddress',
      addressLocality,
      addressRegion,
      addressCountry
    };
  }

  /**
   * Generate geo coordinates for the course
   */
  private generateGeoCoordinates(course: AutomatedCourseDetails): GeoCoordinates {
    return {
      '@type': 'GeoCoordinates',
      latitude: course.latitude || 0,
      longitude: course.longitude || 0
    };
  }

  /**
   * Generate amenity features for the course
   */
  private generateAmenityFeatures(course: AutomatedCourseDetails): LocationFeatureSpecification[] {
    const features: LocationFeatureSpecification[] = [];

    if (course.totalYardage) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Total Yardage',
        value: course.totalYardage
      });
    }

    if (course.parScore) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Par',
        value: course.parScore
      });
    }

    if (course.numberOfHoles) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Number of Holes',
        value: course.numberOfHoles
      });
    }

    if (course.courseRating) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Course Rating',
        value: course.courseRating
      });
    }

    if (course.slopeRating) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Slope Rating',
        value: course.slopeRating
      });
    }

    if (course.courseType) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Course Type',
        value: course.courseType
      });
    }

    if (course.architect) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Architect',
        value: course.architect
      });
    }

    if (course.openingYear) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Opening Year',
        value: course.openingYear
      });
    }

    // Add accessibility features
    if (course.publicAccess) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Public Access',
        value: 'Yes'
      });
    }

    if (course.cartRequired) {
      features.push({
        '@type': 'LocationFeatureSpecification',
        name: 'Cart Required',
        value: 'Yes'
      });
    }

    return features;
  }

  /**
   * Generate aggregate rating if available
   */
  private generateAggregateRating(course: AutomatedCourseDetails): AggregateRating | undefined {
    // This would be populated from actual review data in a real implementation
    // For now, we'll check if there's any rating information available
    if (course.averageRating && course.userReviews) {
      return {
        '@type': 'AggregateRating',
        ratingValue: course.averageRating,
        ratingCount: course.userReviews.length,
        bestRating: 5,
        worstRating: 1
      };
    }

    return undefined;
  }

  /**
   * Generate reserve action for tee time booking
   */
  private generateReserveAction(course: AutomatedCourseDetails): ReserveAction | undefined {
    if (course.teeTimeBookingUrl) {
      return {
        '@type': 'ReserveAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: course.teeTimeBookingUrl,
          inLanguage: 'en-US'
        },
        result: {
          '@type': 'Reservation',
          '@id': course.teeTimeBookingUrl
        }
      };
    }

    return undefined;
  }

  /**
   * Sanitize description for structured data
   */
  private sanitizeDescription(description: string): string {
    return description
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 300); // Limit length
  }

  /**
   * Extract city from location string
   */
  private extractCity(location: string): string {
    const parts = location.split(',').map(part => part.trim());
    return parts[0] || '';
  }

  /**
   * Extract state from location string
   */
  private extractState(location: string): string {
    const parts = location.split(',').map(part => part.trim());
    if (parts.length >= 2) {
      return this.normalizeStateName(parts[1]);
    }
    return '';
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
      'CO': 'Colorado',
      'UT': 'Utah',
      'OR': 'Oregon',
      'WA': 'Washington',
      'MI': 'Michigan',
      'OH': 'Ohio',
      'PA': 'Pennsylvania',
      'VA': 'Virginia',
      'MD': 'Maryland',
      'NJ': 'New Jersey',
      'CT': 'Connecticut',
      'MA': 'Massachusetts',
      'RI': 'Rhode Island',
      'VT': 'Vermont',
      'NH': 'New Hampshire',
      'ME': 'Maine'
    };

    return stateMap[state.toUpperCase()] || state;
  }

  /**
   * Convert string to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Generate fallback structured data in case of errors
   */
  private generateFallbackStructuredData(course: AutomatedCourseDetails): StructuredDataSchema {
    const fallbackGolfCourse: GolfCourseSchema = {
      '@context': 'https://schema.org',
      '@type': 'GolfCourse',
      name: course.name,
      address: {
        '@type': 'PostalAddress',
        addressLocality: this.extractCity(course.location) || 'Unknown',
        addressRegion: this.extractState(course.location) || 'Unknown',
        addressCountry: 'US'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: course.latitude || 0,
        longitude: course.longitude || 0
      },
      amenityFeature: []
    };

    const fallbackBreadcrumb: BreadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: this.config.siteUrl
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: course.name,
          item: `${this.config.siteUrl}/courses/${course.id}`
        }
      ]
    };

    return {
      golfCourse: fallbackGolfCourse,
      breadcrumb: fallbackBreadcrumb,
      organization: this.config.structuredData.organization
    };
  }

  /**
   * Validate structured data schema
   */
  validateStructuredData(schema: StructuredDataSchema): boolean {
    try {
      // Basic validation of required fields
      if (!schema.golfCourse['@context'] || !schema.golfCourse['@type']) {
        return false;
      }

      if (!schema.golfCourse.name || !schema.golfCourse.address) {
        return false;
      }

      if (!schema.breadcrumb['@context'] || !schema.breadcrumb['@type']) {
        return false;
      }

      if (!schema.breadcrumb.itemListElement || schema.breadcrumb.itemListElement.length === 0) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating structured data', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}

/**
 * Standalone function for generating structured data (for test compatibility)
 */
export function generateStructuredData(
  courseData: AutomatedCourseDetails,
  weatherData?: any
): any {
  try {
    const location = extractLocationParts(courseData.location);
    const coordinates = extractCoordinates(courseData.location);

    // Base structured data following schema.org/GolfCourse
    const structuredData: any = {
      '@context': 'https://schema.org',
      '@type': 'GolfCourse',
      name: courseData.name,
      description: courseData.description || `${courseData.name} golf course`,
      sport: 'Golf',
      category: 'GolfCourse',

      // Address information
      address: {
        '@type': 'PostalAddress',
        streetAddress: location.street || courseData.location,
        addressLocality: location.city || 'Unknown',
        addressRegion: location.state || 'Unknown',
        postalCode: location.zip || 'Unknown',
        addressCountry: 'US'
      },

      // Geographic coordinates
      geo: {
        '@type': 'GeoCoordinates',
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      },

      // Contact information
      ...(courseData.phoneNumber && { telephone: courseData.phoneNumber }),
      ...(courseData.website && { url: courseData.website }),

      // Golf course specific properties
      numberOfHoles: courseData.numberOfHoles || 18,
      ...(courseData.par && { par: courseData.par }),
      ...(courseData.totalYardage && { courseLength: courseData.totalYardage }),
      ...(courseData.architect && { architect: courseData.architect }),
      ...(courseData.establishedYear && { foundingDate: courseData.establishedYear.toString() }),
      ...(courseData.greensFeePriceRange && { priceRange: courseData.greensFeePriceRange }),

      // Amenities and features
      amenityFeature: generateAmenityFeatures(courseData),

      // Access and membership
      ...(courseData.publicAccess !== undefined && {
        publicAccess: courseData.publicAccess
      }),

      // Quality and rating
      ...(courseData.qualityScore && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: Math.round((courseData.qualityScore / 100) * 5 * 10) / 10, // Convert to 5-star scale
          bestRating: 5,
          worstRating: 1,
          ratingCount: 1
        }
      }),

      // Business hours (if available)
      ...(generateOpeningHours()),

      // Images (if available)
      ...(generateImageData(courseData))
    };

    // Add weather data if available
    if (weatherData) {
      structuredData.additionalProperty = generateWeatherProperties(weatherData);
    }

    logger.debug('Generated structured data', {
      courseId: courseData.id,
      courseName: courseData.name,
      structuredDataSize: JSON.stringify(structuredData).length
    });

    return structuredData;

  } catch (error) {
    logger.error('Error generating structured data', {
      courseId: courseData.id,
      courseName: courseData.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Return minimal valid structured data
    return {
      '@context': 'https://schema.org',
      '@type': 'GolfCourse',
      name: courseData.name,
      description: courseData.description || `${courseData.name} golf course`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Unknown',
        addressRegion: 'Unknown',
        addressCountry: 'US'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 40.0,
        longitude: -74.0
      }
    };
  }
}

/**
 * Generate amenity features for schema.org
 */
function generateAmenityFeatures(courseData: AutomatedCourseDetails): any[] {
  const amenities: any[] = [];

  const amenityMap = [
    { field: 'drivingRange', name: 'Driving Range' },
    { field: 'puttingGreen', name: 'Putting Green' },
    { field: 'chippingGreen', name: 'Chipping Green' },
    { field: 'proShop', name: 'Pro Shop' },
    { field: 'restaurant', name: 'Restaurant' },
    { field: 'clubhouse', name: 'Clubhouse' },
    { field: 'rentals', name: 'Equipment Rentals' },
    { field: 'lessons', name: 'Golf Lessons' }
  ];

  amenityMap.forEach(({ field, name }) => {
    if (courseData[field as keyof AutomatedCourseDetails]) {
      amenities.push({
        '@type': 'LocationFeatureSpecification',
        name: name,
        value: true
      });
    }
  });

  // Add course type as amenity
  if (courseData.courseType) {
    amenities.push({
      '@type': 'LocationFeatureSpecification',
      name: 'Course Type',
      value: courseData.courseType
    });
  }

  // Add difficulty as amenity
  if (courseData.difficulty) {
    amenities.push({
      '@type': 'LocationFeatureSpecification',
      name: 'Difficulty Level',
      value: courseData.difficulty
    });
  }

  // Add cart requirement
  if (courseData.cartRequired !== undefined) {
    amenities.push({
      '@type': 'LocationFeatureSpecification',
      name: 'Cart Required',
      value: courseData.cartRequired
    });
  }

  return amenities;
}

/**
 * Generate opening hours data (placeholder implementation)
 */
function generateOpeningHours(): { openingHours?: string[] } {
  // This would typically come from course data
  // For now, return typical golf course hours
  return {
    openingHours: [
      'Mo-Su 06:00-19:00'
    ]
  };
}

/**
 * Generate image data for structured data
 */
function generateImageData(courseData: AutomatedCourseDetails): { image?: string[] } {
  const images: string[] = [];

  // Add hero image
  images.push(`/media/courses/${courseData.id}/optimized/hero/main.webp`);

  // Add gallery images (placeholder)
  for (let i = 1; i <= 3; i++) {
    images.push(`/media/courses/${courseData.id}/optimized/gallery/image-${i}.webp`);
  }

  return images.length > 0 ? { image: images } : {};
}

/**
 * Generate weather-related properties
 */
function generateWeatherProperties(weatherData: any): any[] {
  const properties: any[] = [];

  if (weatherData.current) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Current Temperature',
      value: `${weatherData.current.temperature}°F`
    });

    properties.push({
      '@type': 'PropertyValue',
      name: 'Weather Conditions',
      value: weatherData.current.description
    });

    if (weatherData.current.windSpeed) {
      properties.push({
        '@type': 'PropertyValue',
        name: 'Wind Speed',
        value: `${weatherData.current.windSpeed} mph`
      });
    }
  }

  return properties;
}

/**
 * Extract location parts from location string
 */
function extractLocationParts(location: string): {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
} {
  try {
    const parts = location.split(',').map(part => part.trim());

    if (parts.length === 1) {
      return { city: parts[0] };
    }

    if (parts.length === 2) {
      const stateZipMatch = parts[1].match(/([A-Z]{2})\s*(\d{5})?/);
      return {
        city: parts[0],
        state: stateZipMatch ? stateZipMatch[1] : parts[1],
        zip: stateZipMatch ? stateZipMatch[2] : undefined
      };
    }

    if (parts.length >= 3) {
      const lastPart = parts[parts.length - 1];
      const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})?/);

      return {
        street: parts.slice(0, -2).join(', '),
        city: parts[parts.length - 2],
        state: stateZipMatch ? stateZipMatch[1] : undefined,
        zip: stateZipMatch ? stateZipMatch[2] : undefined
      };
    }

    return {};
  } catch (error) {
    logger.warn('Error parsing location', { location, error });
    return { city: location };
  }
}

/**
 * Extract or estimate coordinates from location
 * This is a placeholder - in a real implementation, you'd use geocoding
 */
function extractCoordinates(location: string): { latitude: number; longitude: number } {
  // Default to center of US for placeholder
  let latitude = 39.8283;
  let longitude = -98.5795;

  // Simple state-based coordinate estimation
  const stateCoordinates: { [key: string]: [number, number] } = {
    'CA': [36.7783, -119.4179],
    'FL': [27.7663, -82.6404],
    'TX': [31.0545, -97.5635],
    'NY': [42.1657, -74.9481],
    'GA': [33.0406, -83.6431],
    'NC': [35.5397, -79.8431],
    'AZ': [33.7298, -111.4312],
    'SC': [33.8361, -81.1637],
    'NV': [38.3135, -117.0554],
    'VA': [37.7693, -78.17]
  };

  // Extract state from location
  const stateMatch = location.match(/\b([A-Z]{2})\b/);
  if (stateMatch && stateCoordinates[stateMatch[1]]) {
    [latitude, longitude] = stateCoordinates[stateMatch[1]];
  }

  return { latitude, longitude };
}