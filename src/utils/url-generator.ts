import type { AutomatedCourseDetails } from '../types/quality.types';
import type { URLStructure } from '../types/seo.types';
import logger from './logger';

/**
 * URL Generator Utility
 *
 * Generates SEO-friendly URLs for golf course pages with clean, hierarchical structure:
 * - /courses/state/city/course-name
 * - Canonical URL management
 * - Route generation for state and city pages
 * - Breadcrumb URL generation
 */
export class URLGenerator {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Generate complete URL structure for a golf course
   */
  generateURLStructure(course: AutomatedCourseDetails): URLStructure {
    try {
      const courseUrl = this.generateCourseURL(course);
      const canonicalUrl = this.generateCanonicalURL(course);
      const state = this.extractState(course.location || '');
      const city = this.extractCity(course.location || '');
      const stateUrl = this.generateStatePageURL(state);
      const cityUrl = this.generateCityPageURL(state, city);
      const breadcrumbUrls = this.generateBreadcrumbURLs(state, city, course);

      return {
        courseUrl,
        canonicalUrl,
        stateUrl,
        cityUrl,
        breadcrumbUrls
      };
    } catch (error) {
      logger.error('Error generating URL structure', {
        courseId: course.id,
        courseName: course.name,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return fallback URL structure
      return this.generateFallbackURLStructure(course);
    }
  }

  /**
   * Generate SEO-friendly course URL
   * Format: /courses/state/city/course-name
   */
  generateCourseURL(course: AutomatedCourseDetails): string {
    const state = this.extractState(course.location || '');
    const city = this.extractCity(course.location || '');
    const courseName = this.sanitizeCourseName(course.name);

    const stateSlug = this.slugify(state);
    const citySlug = this.slugify(city);
    const courseSlug = this.slugify(courseName);

    return `/courses/${stateSlug}/${citySlug}/${courseSlug}`;
  }

  /**
   * Generate canonical URL for the course
   */
  generateCanonicalURL(course: AutomatedCourseDetails): string {
    const courseURL = this.generateCourseURL(course);
    return `${this.baseUrl}${courseURL}`;
  }

  /**
   * Generate state page URL
   * Format: /courses/state
   */
  generateStatePageURL(state: string): string {
    const stateSlug = this.slugify(state);
    return `/courses/${stateSlug}`;
  }

  /**
   * Generate city page URL
   * Format: /courses/state/city
   */
  generateCityPageURL(state: string, city: string): string {
    const stateSlug = this.slugify(state);
    const citySlug = this.slugify(city);
    return `/courses/${stateSlug}/${citySlug}`;
  }

  /**
   * Generate breadcrumb URLs for navigation
   */
  generateBreadcrumbURLs(state: string, city: string, course: AutomatedCourseDetails): string[] {
    return [
      this.baseUrl, // Home
      `${this.baseUrl}/courses`, // Golf Courses
      `${this.baseUrl}${this.generateStatePageURL(state)}`, // State
      `${this.baseUrl}${this.generateCityPageURL(state, city)}`, // City
      `${this.baseUrl}${this.generateCourseURL(course)}` // Course
    ];
  }

  /**
   * Generate URL for course search by filters
   */
  generateSearchURL(filters: {
    state?: string;
    city?: string;
    courseType?: string;
    architect?: string;
    priceRange?: string;
  }): string {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value.toString());
      }
    });

    const queryString = params.toString();
    return `/courses/search${queryString ? `?${queryString}` : ''}`;
  }

  /**
   * Generate URL for course listing page with pagination
   */
  generateListingURL(page: number = 1, filters: Record<string, string> = {}): string {
    const params = new URLSearchParams(filters);

    if (page > 1) {
      params.append('page', page.toString());
    }

    const queryString = params.toString();
    return `/courses${queryString ? `?${queryString}` : ''}`;
  }

  /**
   * Generate sitemap URLs for SEO
   */
  generateSitemapURLs(courses: AutomatedCourseDetails[]): string[] {
    const urls = new Set<string>();

    // Add main pages
    urls.add(this.baseUrl);
    urls.add(`${this.baseUrl}/courses`);

    // Add state and city pages
    const locations = new Set<string>();
    const states = new Set<string>();

    courses.forEach(course => {
      const state = this.extractState(course.location || '');
      const city = this.extractCity(course.location || '');

      states.add(state);
      locations.add(`${state}|${city}`);

      // Add course URL
      urls.add(this.generateCanonicalURL(course));
    });

    // Add state URLs
    states.forEach(state => {
      urls.add(`${this.baseUrl}${this.generateStatePageURL(state)}`);
    });

    // Add city URLs
    locations.forEach(location => {
      const [state, city] = location.split('|');
      urls.add(`${this.baseUrl}${this.generateCityPageURL(state, city)}`);
    });

    return Array.from(urls);
  }

  /**
   * Extract state from location string
   */
  private extractState(location: string): string {
    const parts = location.split(',').map(part => part.trim());

    if (parts.length >= 2) {
      const state = parts[1];
      return this.normalizeStateName(state);
    }

    return 'Unknown';
  }

  /**
   * Extract city from location string
   */
  private extractCity(location: string): string {
    const parts = location.split(',').map(part => part.trim());
    return parts[0] || 'Unknown';
  }

  /**
   * Sanitize course name for URL generation
   */
  private sanitizeCourseName(name: string): string {
    return name
      .replace(/golf course|golf club|country club/gi, '') // Remove common suffixes
      .replace(/\b(the|at|of|in)\b/gi, '') // Remove common articles
      .trim();
  }

  /**
   * Convert string to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
  }

  /**
   * Normalize state names and abbreviations
   */
  private normalizeStateName(state: string): string {
    const stateMap: Record<string, string> = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
      'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
      'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
      'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
      'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
      'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
      'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
      'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
      'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
      'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
      'WI': 'Wisconsin', 'WY': 'Wyoming'
    };

    const upperState = state.toUpperCase();
    return stateMap[upperState] || state;
  }

  /**
   * Generate fallback URL structure
   */
  private generateFallbackURLStructure(course: AutomatedCourseDetails): URLStructure {
    const fallbackUrl = `/courses/${course.id}`;
    const canonicalUrl = `${this.baseUrl}${fallbackUrl}`;

    return {
      courseUrl: fallbackUrl,
      canonicalUrl,
      stateUrl: '/courses',
      cityUrl: '/courses',
      breadcrumbUrls: [
        this.baseUrl,
        `${this.baseUrl}/courses`,
        canonicalUrl
      ]
    };
  }

  /**
   * Validate URL structure
   */
  validateURL(url: string): boolean {
    try {
      // Check if URL is well-formed
      if (!url.startsWith('/') && !url.startsWith('http')) {
        return false;
      }

      // Check for invalid characters
      const invalidChars = /[<>"\s{}|\\^`\[\]]/;
      if (invalidChars.test(url)) {
        return false;
      }

      // Check URL length (reasonable limit)
      if (url.length > 2048) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating URL', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Parse course information from URL
   */
  parseURLToCourseInfo(url: string): {
    state?: string;
    city?: string;
    courseName?: string;
    isValid: boolean;
  } {
    try {
      // Remove base URL and query parameters
      const path = url.replace(this.baseUrl, '').split('?')[0];

      // Expected format: /courses/state/city/course-name
      const pathParts = path.split('/').filter(part => part.length > 0);

      if (pathParts.length >= 4 && pathParts[0] === 'courses') {
        return {
          state: this.unslugify(pathParts[1]),
          city: this.unslugify(pathParts[2]),
          courseName: this.unslugify(pathParts[3]),
          isValid: true
        };
      }

      return { isValid: false };
    } catch (error) {
      logger.error('Error parsing URL', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return { isValid: false };
    }
  }

  /**
   * Convert slug back to readable text
   */
  private unslugify(slug: string): string {
    return slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Generate URL for course comparison page
   */
  generateComparisonURL(courseIds: string[]): string {
    const params = new URLSearchParams();
    params.append('courses', courseIds.join(','));
    return `/courses/compare?${params.toString()}`;
  }

  /**
   * Generate URL for course map view
   */
  generateMapURL(bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): string {
    if (bounds) {
      const params = new URLSearchParams({
        north: bounds.north.toString(),
        south: bounds.south.toString(),
        east: bounds.east.toString(),
        west: bounds.west.toString()
      });
      return `/courses/map?${params.toString()}`;
    }

    return '/courses/map';
  }
}

/**
 * Standalone function to generate URL slug (for compatibility)
 */
export function generateUrlSlug(courseName: string, location: string): string {
  const generator = new URLGenerator('https://example.com');
  const course = {
    id: 'temp',
    name: courseName,
    location: location,
    qualityScore: 80,
    completenessScore: 80,
    lastUpdated: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;

  const urlStructure = generator.generateURLStructure(course);
  return urlStructure.courseUrl.replace('/courses/', '');
}