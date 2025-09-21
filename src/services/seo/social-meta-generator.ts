import type { AutomatedCourseDetails } from '../../types/quality.types';
import type {
  SocialMetaTags,
  OpenGraphTags,
  TwitterTags,
  FacebookTags,
  SEOMetadata,
  SEOConfiguration
} from '../../types/seo.types';
import logger from '../../utils/logger';

/**
 * Social Media Meta Generator Service
 *
 * Generates optimized social media meta tags for golf course pages including:
 * - Open Graph tags for Facebook, LinkedIn, and other platforms
 * - Twitter Card tags for enhanced Twitter sharing
 * - Facebook-specific tags for improved sharing
 */
export class SocialMetaGenerator {
  private config: SEOConfiguration;

  constructor(config: SEOConfiguration) {
    this.config = config;
  }

  /**
   * Generate complete social media meta tags for a golf course
   */
  generateSocialTags(
    course: AutomatedCourseDetails,
    seoData: SEOMetadata
  ): SocialMetaTags {
    try {
      const openGraph = this.generateOpenGraphTags(course, seoData);
      const twitter = this.generateTwitterTags(course, seoData);
      const facebook = this.generateFacebookTags();

      logger.debug('Generated social media tags for course', {
        courseId: course.id,
        courseName: course.name,
        hasOpenGraph: !!openGraph,
        hasTwitter: !!twitter,
        hasFacebook: !!facebook
      });

      return {
        openGraph,
        twitter,
        facebook
      };
    } catch (error) {
      logger.error('Error generating social media tags', {
        courseId: course.id,
        courseName: course.name,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return fallback social tags
      return this.generateFallbackSocialTags(course, seoData);
    }
  }

  /**
   * Generate Open Graph meta tags for Facebook, LinkedIn, and other platforms
   */
  private generateOpenGraphTags(
    course: AutomatedCourseDetails,
    seo: SEOMetadata
  ): OpenGraphTags {
    const location = this.extractLocation(course.location);
    const socialImage = this.getSocialImage(course);

    const tags: OpenGraphTags = {
      'og:title': this.optimizeOGTitle(seo.title),
      'og:description': this.optimizeOGDescription(seo.description),
      'og:image': socialImage.url,
      'og:image:width': socialImage.width,
      'og:image:height': socialImage.height,
      'og:type': 'place',
      'og:url': seo.canonicalUrl,
      'og:site_name': this.config.siteName
    };

    // Add location-specific Open Graph tags
    if (course.latitude && course.longitude) {
      tags['place:location:latitude'] = course.latitude.toString();
      tags['place:location:longitude'] = course.longitude.toString();
    }

    // Add business contact data
    if (course.location) {
      tags['business:contact_data:street_address'] = course.location;
    }

    if (course.website) {
      tags['business:contact_data:website'] = course.website;
    }

    if (course.phoneNumber) {
      tags['business:contact_data:phone_number'] = course.phoneNumber;
    }

    return tags;
  }

  /**
   * Generate Twitter Card meta tags
   */
  private generateTwitterTags(
    course: AutomatedCourseDetails,
    seo: SEOMetadata
  ): TwitterTags {
    const socialImage = this.getSocialImage(course);

    const tags: TwitterTags = {
      'twitter:card': 'summary_large_image',
      'twitter:title': this.optimizeTwitterTitle(seo.title),
      'twitter:description': this.optimizeTwitterDescription(seo.description),
      'twitter:image': socialImage.url,
      'twitter:image:alt': this.generateImageAltText(course)
    };

    // Add Twitter handle if configured
    if (this.config.socialHandles.twitter) {
      tags['twitter:site'] = this.config.socialHandles.twitter;
      tags['twitter:creator'] = this.config.socialHandles.twitter;
    }

    return tags;
  }

  /**
   * Generate Facebook-specific meta tags
   */
  private generateFacebookTags(): FacebookTags | undefined {
    const tags: FacebookTags = {};

    // Add Facebook app ID if configured
    if (this.config.analytics?.googleAnalytics) {
      // This would be where you'd add Facebook app ID if available
      // tags['fb:app_id'] = 'your_app_id';
    }

    return Object.keys(tags).length > 0 ? tags : undefined;
  }

  /**
   * Optimize Open Graph title (max 95 characters)
   */
  private optimizeOGTitle(title: string): string {
    const maxLength = 95;

    if (title.length <= maxLength) {
      return title;
    }

    // Truncate at word boundary
    const truncated = title.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');

    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }

    return truncated + '...';
  }

  /**
   * Optimize Open Graph description (max 300 characters)
   */
  private optimizeOGDescription(description: string): string {
    const maxLength = 300;

    if (description.length <= maxLength) {
      return description;
    }

    // Truncate at sentence boundary if possible
    const sentences = description.split('.');
    let result = '';

    for (const sentence of sentences) {
      if ((result + sentence + '.').length <= maxLength) {
        result += sentence + '.';
      } else {
        break;
      }
    }

    if (result.length < maxLength * 0.7) {
      // If sentence-based truncation is too short, use word boundary
      const truncated = description.substring(0, maxLength - 3);
      const lastSpaceIndex = truncated.lastIndexOf(' ');
      return truncated.substring(0, lastSpaceIndex) + '...';
    }

    return result || description.substring(0, maxLength - 3) + '...';
  }

  /**
   * Optimize Twitter title (max 70 characters)
   */
  private optimizeTwitterTitle(title: string): string {
    const maxLength = 70;

    if (title.length <= maxLength) {
      return title;
    }

    // Remove common suffixes to make room
    const withoutSuffix = title
      .replace(/ \| Golf Course Guide$/, '')
      .replace(/ \| Golf Course$/, '')
      .replace(/ Golf Course$/, '');

    if (withoutSuffix.length <= maxLength) {
      return withoutSuffix;
    }

    // Truncate at word boundary
    const truncated = withoutSuffix.substring(0, maxLength - 3);
    const lastSpaceIndex = truncated.lastIndexOf(' ');

    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }

    return truncated + '...';
  }

  /**
   * Optimize Twitter description (max 200 characters)
   */
  private optimizeTwitterDescription(description: string): string {
    const maxLength = 200;

    if (description.length <= maxLength) {
      return description;
    }

    // Truncate at word boundary
    const truncated = description.substring(0, maxLength - 3);
    const lastSpaceIndex = truncated.lastIndexOf(' ');

    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }

    return truncated + '...';
  }

  /**
   * Get social media optimized image
   */
  private getSocialImage(course: AutomatedCourseDetails): {
    url: string;
    width: string;
    height: string;
  } {
    // Default social image dimensions (Facebook/LinkedIn optimal)
    const defaultImage = {
      url: `${this.config.siteUrl}/images/default-golf-course-social.jpg`,
      width: '1200',
      height: '630'
    };

    if (course.heroImageUrl) {
      // In a real implementation, you might have different sized versions
      // For now, we'll use the hero image
      return {
        url: course.heroImageUrl,
        width: '1200',
        height: '630'
      };
    }

    return defaultImage;
  }

  /**
   * Generate descriptive alt text for social media image
   */
  private generateImageAltText(course: AutomatedCourseDetails): string {
    const location = this.extractCity(course.location);
    let altText = `${course.name} golf course`;

    if (location) {
      altText += ` in ${location}`;
    }

    if (course.architect) {
      altText += ` designed by ${course.architect}`;
    }

    if (course.courseType) {
      altText += `, ${course.courseType.toLowerCase()} layout`;
    }

    return altText;
  }

  /**
   * Extract city from location string for social tags
   */
  private extractCity(location: string): string {
    const parts = location.split(',').map(part => part.trim());
    return parts[0] || '';
  }

  /**
   * Extract location information for social tags
   */
  private extractLocation(location: string): {
    city: string;
    state: string;
    full: string;
  } {
    const parts = location.split(',').map(part => part.trim());

    return {
      city: parts[0] || '',
      state: parts[1] || '',
      full: location
    };
  }

  /**
   * Generate fallback social media tags
   */
  private generateFallbackSocialTags(
    course: AutomatedCourseDetails,
    seo: SEOMetadata
  ): SocialMetaTags {
    const fallbackImage = {
      url: `${this.config.siteUrl}/images/default-golf-course.jpg`,
      width: '1200',
      height: '630'
    };

    return {
      openGraph: {
        'og:title': course.name,
        'og:description': `Golf course information for ${course.name}`,
        'og:image': fallbackImage.url,
        'og:image:width': fallbackImage.width,
        'og:image:height': fallbackImage.height,
        'og:type': 'place',
        'og:url': seo.canonicalUrl,
        'og:site_name': this.config.siteName
      },
      twitter: {
        'twitter:card': 'summary_large_image',
        'twitter:title': course.name,
        'twitter:description': `Golf course information for ${course.name}`,
        'twitter:image': fallbackImage.url,
        'twitter:image:alt': `${course.name} golf course`
      }
    };
  }

  /**
   * Validate social media tags
   */
  validateSocialTags(tags: SocialMetaTags): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Validate Open Graph tags
    if (tags.openGraph['og:title'].length > 95) {
      issues.push('Open Graph title exceeds 95 characters');
    }

    if (tags.openGraph['og:description'].length > 300) {
      issues.push('Open Graph description exceeds 300 characters');
    }

    if (!tags.openGraph['og:image'].startsWith('http')) {
      issues.push('Open Graph image should be a complete URL');
    }

    // Validate Twitter tags
    if (tags.twitter['twitter:title'].length > 70) {
      issues.push('Twitter title exceeds 70 characters');
    }

    if (tags.twitter['twitter:description'].length > 200) {
      issues.push('Twitter description exceeds 200 characters');
    }

    if (!tags.twitter['twitter:image'].startsWith('http')) {
      issues.push('Twitter image should be a complete URL');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Generate social sharing preview text
   */
  generateSharingPreview(course: AutomatedCourseDetails): {
    facebook: string;
    twitter: string;
    linkedin: string;
  } {
    const location = this.extractCity(course.location);
    const baseName = course.name;

    return {
      facebook: `Check out ${baseName} golf course in ${location}! 🏌️‍♂️`,
      twitter: `⛳ Discover ${baseName} golf course in ${location} #Golf #${location.replace(/\s+/g, '')}`,
      linkedin: `Explore ${baseName}, a premier golf destination in ${location}.`
    };
  }
}

/**
 * Standalone function for generating social meta tags (for compatibility)
 */
export function generateSocialMetaTags(
  courseData: AutomatedCourseDetails,
  config: {
    title: string;
    description: string;
    url: string;
    image?: string;
    siteName: string;
    twitterHandle?: string;
    facebookAppId?: string;
    locale?: string;
  }
): {
  openGraph: {
    title: string;
    description: string;
    type: string;
    url: string;
    image?: string;
    imageAlt?: string;
    siteName: string;
    locale: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    image?: string;
    imageAlt?: string;
    site?: string;
    creator?: string;
  };
  facebook?: {
    appId?: string;
  };
} {
  try {
    // Generate optimized titles and descriptions for social platforms
    const socialTitle = generateSocialTitle(courseData, config.title);
    const socialDescription = generateSocialDescription(courseData, config.description);
    const imageUrl = config.image || generateDefaultImage(courseData);
    const imageAlt = generateImageAlt(courseData);

    // Open Graph meta tags (Facebook, LinkedIn, etc.)
    const openGraph = {
      title: socialTitle,
      description: socialDescription,
      type: 'website',
      url: config.url,
      ...(imageUrl && { image: imageUrl }),
      ...(imageAlt && { imageAlt }),
      siteName: config.siteName,
      locale: config.locale || 'en_US'
    };

    // Twitter Card meta tags
    const twitter = {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: socialTitle,
      description: socialDescription,
      ...(imageUrl && { image: imageUrl }),
      ...(imageAlt && { imageAlt }),
      ...(config.twitterHandle && { site: config.twitterHandle }),
      ...(config.twitterHandle && { creator: config.twitterHandle })
    };

    // Facebook specific tags
    const facebook = config.facebookAppId ? { appId: config.facebookAppId } : undefined;

    logger.debug('Generated social meta tags', {
      courseId: courseData.id,
      courseName: courseData.name,
      hasImage: !!imageUrl,
      titleLength: socialTitle.length,
      descriptionLength: socialDescription.length
    });

    return {
      openGraph,
      twitter,
      ...(facebook && { facebook })
    };

  } catch (error) {
    logger.error('Error generating social meta tags', {
      courseId: courseData.id,
      courseName: courseData.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Return fallback social meta tags
    return generateFallbackSocialMeta(courseData, config);
  }
}

/**
 * Generate social media optimized title
 */
function generateSocialTitle(courseData: AutomatedCourseDetails, baseTitle: string): string {
  // Social media titles can be slightly longer than SEO titles
  const maxLength = 70;

  let title = baseTitle;

  // If base title is too long, create a shorter version
  if (title.length > maxLength) {
    const courseName = courseData.name;
    const location = extractLocationParts(courseData.location);

    title = courseName;

    // Add location if there's room
    if (location.city && title.length + location.city.length + 3 <= maxLength) {
      title += ` - ${location.city}`;
    } else if (location.state && title.length + location.state.length + 3 <= maxLength) {
      title += ` - ${location.state}`;
    }

    // Add descriptor if there's room
    if (courseData.difficulty === 'Championship' && title.length + 15 <= maxLength) {
      title += ' Golf Course';
    } else if (title.length + 12 <= maxLength) {
      title += ' Golf Course';
    }
  }

  return title.substring(0, maxLength);
}

/**
 * Generate social media optimized description
 */
function generateSocialDescription(courseData: AutomatedCourseDetails, baseDescription: string): string {
  // Social media descriptions can be longer than meta descriptions
  const maxLength = 200;

  let description = baseDescription;

  // If base description is too short, enhance it for social media
  if (description.length < 100) {
    description = enhanceDescriptionForSocial(courseData, description);
  }

  // Ensure description ends with a call-to-action
  if (!description.toLowerCase().includes('book') &&
      !description.toLowerCase().includes('visit') &&
      !description.toLowerCase().includes('play')) {

    if (courseData.teeTimeBookingUrl) {
      description += ' Book your tee time today!';
    } else if (courseData.phoneNumber) {
      description += ' Call to reserve your round!';
    } else {
      description += ' Plan your visit today!';
    }
  }

  return description.substring(0, maxLength);
}

/**
 * Enhance description for social media sharing
 */
function enhanceDescriptionForSocial(courseData: AutomatedCourseDetails, baseDescription: string): string {
  let enhanced = baseDescription;

  // Add notable features for social engagement
  const features = [];

  if (courseData.difficulty === 'Championship') {
    features.push('championship golf course');
  }

  if (courseData.architect && courseData.architect.toLowerCase().includes('nicklaus')) {
    features.push('Jack Nicklaus design');
  } else if (courseData.architect && courseData.architect.toLowerCase().includes('palmer')) {
    features.push('Arnold Palmer design');
  } else if (courseData.architect) {
    features.push(`designed by ${courseData.architect}`);
  }

  if (courseData.totalYardage && courseData.totalYardage > 7000) {
    features.push('challenging layout');
  }

  if (courseData.publicAccess === false) {
    features.push('exclusive private club');
  } else if (courseData.publicAccess === true) {
    features.push('open to the public');
  }

  // Add pricing appeal
  if (courseData.greensFeePriceRange) {
    const priceRange = courseData.greensFeePriceRange.toLowerCase();
    if (priceRange.includes('$') && !priceRange.includes('$200')) {
      features.push('affordable rates');
    }
  }

  // Incorporate features into description
  if (features.length > 0) {
    const featureText = features.slice(0, 2).join(' and '); // Limit to 2 features
    enhanced += ` Experience this ${featureText}.`;
  }

  return enhanced;
}

/**
 * Generate default image URL for course
 */
function generateDefaultImage(courseData: AutomatedCourseDetails): string {
  // Return path to hero image or fallback
  return `/media/courses/${courseData.id}/optimized/hero/main.webp`;
}

/**
 * Generate alt text for social media image
 */
function generateImageAlt(courseData: AutomatedCourseDetails): string {
  const location = extractLocationParts(courseData.location);

  let altText = `${courseData.name} golf course`;

  if (location.city) {
    altText += ` in ${location.city}`;
  }

  if (location.state) {
    altText += `, ${location.state}`;
  }

  // Add course features to alt text
  const features = [];
  if (courseData.numberOfHoles && courseData.numberOfHoles !== 18) {
    features.push(`${courseData.numberOfHoles}-hole`);
  }
  if (courseData.difficulty) {
    features.push(courseData.difficulty.toLowerCase());
  }

  if (features.length > 0) {
    altText += ` - ${features.join(' ')} course`;
  }

  return altText;
}

/**
 * Extract location parts from location string
 */
function extractLocationParts(location: string): { city?: string; state?: string } {
  const parts = location.split(',').map(part => part.trim());

  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const stateMatch = lastPart.match(/([A-Z]{2})/);

    return {
      city: parts[parts.length - 2],
      state: stateMatch ? stateMatch[1] : undefined
    };
  }

  return { city: parts[0] };
}

/**
 * Generate fallback social meta tags
 */
function generateFallbackSocialMeta(courseData: AutomatedCourseDetails, config: any): any {
  const fallbackTitle = `${courseData.name} | Golf Course`;
  const fallbackDescription = `Golf course information for ${courseData.name}. View details, rates, and book your tee time.`;

  return {
    openGraph: {
      title: fallbackTitle,
      description: fallbackDescription,
      type: 'website',
      url: config.url,
      siteName: config.siteName,
      locale: 'en_US'
    },
    twitter: {
      card: 'summary',
      title: fallbackTitle,
      description: fallbackDescription
    }
  };
}