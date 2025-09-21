# PR 6: Course Detail Pages and SEO Implementation

*Dynamic course detail page generation with comprehensive SEO optimization*

## 🎯 **Objective**

Implement dynamic course detail pages with advanced SEO optimization, structured data markup, and performance optimization to maximize search engine visibility and user engagement.

## 🌐 **Dynamic Page Generation**

### **Course Detail Page Template System**

```typescript
// src/pages/course-detail.tsx
interface CoursePageProps {
  courseData: AutomatedCourseDetails;
  weatherData: WeatherData;
  nearbyAmenities: POI[];
  seoMetadata: SEOMetadata;
}

const CourseDetailPage: React.FC<CoursePageProps> = ({ courseData, weatherData, nearbyAmenities, seoMetadata }) => {
  return (
    <>
      <Head>
        <title>{seoMetadata.title}</title>
        <meta name="description" content={seoMetadata.description} />
        <meta name="keywords" content={seoMetadata.keywords.join(', ')} />

        {/* Open Graph tags */}
        <meta property="og:title" content={seoMetadata.title} />
        <meta property="og:description" content={seoMetadata.description} />
        <meta property="og:image" content={courseData.heroImageUrl} />
        <meta property="og:type" content="place" />

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateStructuredData(courseData))
          }}
        />
      </Head>

      <CourseHeroSection course={courseData} weather={weatherData} />
      <CourseDetailsSection course={courseData} />
      <CourseHistorySection course={courseData} />
      <PhotoGallerySection images={courseData.galleryImages} />
      <NearbyAmenitiesSection amenities={nearbyAmenities} />
      <ContactBookingSection course={courseData} />
    </>
  );
};
```

### **SEO Metadata Generation**

```typescript
// src/services/seo-generator.ts
interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  breadcrumbs: Breadcrumb[];
  structuredData: object;
}

class SEOGenerator {
  generateCoursePageSEO(courseData: AutomatedCourseDetails): SEOMetadata {
    const title = this.generateTitle(courseData);
    const description = this.generateDescription(courseData);
    const keywords = this.generateKeywords(courseData);

    return {
      title,
      description,
      keywords,
      canonicalUrl: `https://golfjourney.com/courses/${courseData.id}`,
      breadcrumbs: this.generateBreadcrumbs(courseData),
      structuredData: this.generateStructuredData(courseData),
    };
  }

  private generateTitle(course: AutomatedCourseDetails): string {
    // Format: "Course Name - Location | Golf Course Guide"
    const location = this.extractCity(course.location);
    return `${course.name} - ${location} | Golf Course Guide`;
  }

  private generateDescription(course: AutomatedCourseDetails): string {
    // 150-160 character limit for optimal display
    const location = this.extractCity(course.location);
    const architect = course.architect ? ` by ${course.architect}` : '';
    const year = course.openingYear ? ` (${course.openingYear})` : '';

    let description = `${course.name} golf course in ${location}${architect}${year}. `;

    if (course.majorChampionships?.length > 0) {
      description += `Host of ${course.majorChampionships[0]}. `;
    }

    description += 'Course details, weather, tee times & more.';

    // Ensure it fits within 160 characters
    return description.length > 160 ? description.substring(0, 157) + '...' : description;
  }

  private generateKeywords(course: AutomatedCourseDetails): string[] {
    const keywords = [
      course.name.toLowerCase(),
      this.extractCity(course.location).toLowerCase(),
      'golf course',
      'tee times',
      'golf',
    ];

    // Add course-specific keywords
    if (course.architect) keywords.push(course.architect.toLowerCase());
    if (course.courseType) keywords.push(course.courseType);
    if (course.majorChampionships) keywords.push(...course.majorChampionships.map(c => c.toLowerCase()));

    // Add location-based keywords
    const state = this.extractState(course.location);
    if (state) keywords.push(state.toLowerCase());

    return [...new Set(keywords)]; // Remove duplicates
  }
}
```

## 🏗️ **Structured Data Implementation**

### **JSON-LD Schema Markup**

```typescript
// src/services/structured-data-generator.ts
class StructuredDataGenerator {
  generateGolfCourseSchema(course: AutomatedCourseDetails): object {
    return {
      "@context": "https://schema.org",
      "@type": "GolfCourse",
      "name": course.name,
      "description": course.description,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": this.extractCity(course.location),
        "addressRegion": this.extractState(course.location),
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": course.latitude,
        "longitude": course.longitude
      },
      "telephone": course.phoneNumber,
      "url": course.website,
      "image": course.heroImageUrl,
      "architect": course.architect,
      "dateOpened": course.openingYear ? `${course.openingYear}-01-01` : undefined,
      "amenityFeature": this.generateAmenityFeatures(course),
      "priceRange": course.greensFeePriceRange,
      "aggregateRating": course.averageRating ? {
        "@type": "AggregateRating",
        "ratingValue": course.averageRating,
        "ratingCount": course.userReviews?.length || 0
      } : undefined,
      "potentialAction": {
        "@type": "ReserveAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": course.teeTimeBookingUrl,
          "inLanguage": "en-US"
        },
        "result": {
          "@type": "Reservation",
          "@id": course.teeTimeBookingUrl
        }
      }
    };
  }

  generateBreadcrumbSchema(course: AutomatedCourseDetails): object {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://golfjourney.com"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Golf Courses",
          "item": "https://golfjourney.com/courses"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": this.extractState(course.location),
          "item": `https://golfjourney.com/courses/${this.extractState(course.location).toLowerCase()}`
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": course.name,
          "item": `https://golfjourney.com/courses/${course.id}`
        }
      ]
    };
  }

  private generateAmenityFeatures(course: AutomatedCourseDetails): object[] {
    const amenities = [];

    if (course.totalYardage) {
      amenities.push({
        "@type": "LocationFeatureSpecification",
        "name": "Total Yardage",
        "value": course.totalYardage
      });
    }

    if (course.parScore) {
      amenities.push({
        "@type": "LocationFeatureSpecification",
        "name": "Par",
        "value": course.parScore
      });
    }

    if (course.numberOfHoles) {
      amenities.push({
        "@type": "LocationFeatureSpecification",
        "name": "Number of Holes",
        "value": course.numberOfHoles
      });
    }

    return amenities;
  }
}
```

## 📄 **Content Optimization**

### **Content Enhancement System**

```typescript
// src/services/content-optimizer.ts
class ContentOptimizer {
  optimizeContentForSEO(courseData: AutomatedCourseDetails): OptimizedContent {
    return {
      heroSection: this.optimizeHeroContent(courseData),
      aboutSection: this.optimizeAboutContent(courseData),
      historySection: this.optimizeHistoryContent(courseData),
      featuresSection: this.optimizeFeaturesContent(courseData),
      locationSection: this.optimizeLocationContent(courseData),
    };
  }

  private optimizeHeroContent(course: AutomatedCourseDetails): HeroContent {
    const location = this.extractCity(course.location);

    return {
      headline: `${course.name} - Premier Golf in ${location}`,
      subheadline: course.architect ?
        `Experience the masterful design of ${course.architect}` :
        `Discover exceptional golf in ${location}`,
      callToAction: "Book Your Tee Time",
      weatherWidget: true,
      keyHighlights: this.generateKeyHighlights(course),
    };
  }

  private optimizeAboutContent(course: AutomatedCourseDetails): AboutContent {
    // Enhance description with SEO-friendly content
    let optimizedDescription = course.description;

    // Add location context
    if (!optimizedDescription.includes(course.location)) {
      optimizedDescription = `Located in ${course.location}, ${optimizedDescription}`;
    }

    // Add golf-specific terminology
    optimizedDescription = this.addGolfTerminology(optimizedDescription, course);

    // Ensure proper keyword density
    optimizedDescription = this.optimizeKeywordDensity(optimizedDescription, course);

    return {
      description: optimizedDescription,
      quickFacts: this.generateQuickFacts(course),
      highlights: this.generateCourseHighlights(course),
    };
  }

  private generateKeyHighlights(course: AutomatedCourseDetails): string[] {
    const highlights = [];

    if (course.architect) highlights.push(`Designed by ${course.architect}`);
    if (course.openingYear) highlights.push(`Established ${course.openingYear}`);
    if (course.majorChampionships?.length) highlights.push(`Host to ${course.majorChampionships[0]}`);
    if (course.totalYardage) highlights.push(`${course.totalYardage} yards`);
    if (course.courseType) highlights.push(`${course.courseType} course`);

    return highlights.slice(0, 4); // Limit to 4 highlights
  }
}
```

## 🔍 **Technical SEO Implementation**

### **Page Performance Optimization**

```typescript
// src/components/optimized-image.tsx
interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({ src, alt, width, height, priority, className }) => {
  return (
    <picture>
      <source
        srcSet={`${src.replace(/\.(jpg|jpeg|png)$/, '.webp')} 1x, ${src.replace(/\.(jpg|jpeg|png)$/, '@2x.webp')} 2x`}
        type="image/webp"
      />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        className={className}
        onError={(e) => {
          // Fallback to original format if WebP fails
          e.currentTarget.src = src;
        }}
      />
    </picture>
  );
};
```

### **URL Structure and Routing**

```typescript
// src/utils/url-generator.ts
class URLGenerator {
  generateCourseURL(course: AutomatedCourseDetails): string {
    // SEO-friendly URL structure: /courses/state/city/course-name
    const state = this.extractState(course.location).toLowerCase().replace(/\s+/g, '-');
    const city = this.extractCity(course.location).toLowerCase().replace(/\s+/g, '-');
    const courseName = course.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')         // Replace spaces with hyphens
      .replace(/-+/g, '-')          // Replace multiple hyphens with single
      .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens

    return `/courses/${state}/${city}/${courseName}`;
  }

  generateCanonicalURL(course: AutomatedCourseDetails): string {
    return `https://golfjourney.com${this.generateCourseURL(course)}`;
  }

  generateStatePageURL(state: string): string {
    return `/courses/${state.toLowerCase().replace(/\s+/g, '-')}`;
  }

  generateCityPageURL(state: string, city: string): string {
    const stateSlug = state.toLowerCase().replace(/\s+/g, '-');
    const citySlug = city.toLowerCase().replace(/\s+/g, '-');
    return `/courses/${stateSlug}/${citySlug}`;
  }
}
```

## 🏷️ **Meta Tags and Social Sharing**

### **Social Media Optimization**

```typescript
// src/services/social-meta-generator.ts
interface SocialMetaTags {
  openGraph: OpenGraphTags;
  twitter: TwitterTags;
  facebook: FacebookTags;
}

class SocialMetaGenerator {
  generateSocialTags(course: AutomatedCourseDetails, seoData: SEOMetadata): SocialMetaTags {
    return {
      openGraph: this.generateOpenGraphTags(course, seoData),
      twitter: this.generateTwitterTags(course, seoData),
      facebook: this.generateFacebookTags(course, seoData),
    };
  }

  private generateOpenGraphTags(course: AutomatedCourseDetails, seo: SEOMetadata): OpenGraphTags {
    return {
      'og:title': seo.title,
      'og:description': seo.description,
      'og:image': course.heroImageUrl,
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:type': 'place',
      'og:url': seo.canonicalUrl,
      'og:site_name': 'Golf Journey Map',
      'place:location:latitude': course.latitude.toString(),
      'place:location:longitude': course.longitude.toString(),
      'business:contact_data:street_address': course.location,
      'business:contact_data:website': course.website,
      'business:contact_data:phone_number': course.phoneNumber,
    };
  }

  private generateTwitterTags(course: AutomatedCourseDetails, seo: SEOMetadata): TwitterTags {
    return {
      'twitter:card': 'summary_large_image',
      'twitter:title': seo.title,
      'twitter:description': seo.description,
      'twitter:image': course.heroImageUrl,
      'twitter:image:alt': `${course.name} golf course`,
    };
  }
}
```

## 📊 **Analytics and Performance Tracking**

### **SEO Performance Monitoring**

```typescript
// src/services/seo-monitor.ts
interface SEOMetrics {
  pageLoadSpeed: number;
  coreWebVitals: {
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
  };
  structuredDataValidation: boolean;
  mobileUsability: boolean;
  indexabilityScore: number;
}

class SEOMonitor {
  async analyzePage(url: string): Promise<SEOMetrics> {
    const performance = await this.measurePagePerformance(url);
    const structuredData = await this.validateStructuredData(url);
    const mobile = await this.testMobileUsability(url);

    return {
      pageLoadSpeed: performance.loadTime,
      coreWebVitals: performance.vitals,
      structuredDataValidation: structuredData.isValid,
      mobileUsability: mobile.isUsable,
      indexabilityScore: this.calculateIndexabilityScore(performance, structuredData, mobile),
    };
  }

  private calculateIndexabilityScore(performance: any, structuredData: any, mobile: any): number {
    let score = 100;

    // Performance impact (40% of score)
    if (performance.loadTime > 3000) score -= 20;
    if (performance.vitals.lcp > 2500) score -= 10;
    if (performance.vitals.cls > 0.1) score -= 10;

    // Structured data impact (30% of score)
    if (!structuredData.isValid) score -= 30;

    // Mobile usability impact (30% of score)
    if (!mobile.isUsable) score -= 30;

    return Math.max(0, score);
  }
}
```

## 📋 **Acceptance Criteria**

- [ ] Dynamic course detail page generation implemented
- [ ] Comprehensive SEO metadata generation for all pages
- [ ] JSON-LD structured data markup for golf courses
- [ ] Optimized image delivery with WebP and responsive variants
- [ ] SEO-friendly URL structure and routing
- [ ] Open Graph and Twitter Card meta tags
- [ ] Performance optimized with lazy loading and code splitting
- [ ] Mobile-responsive design with good Core Web Vitals
- [ ] Breadcrumb navigation with structured data
- [ ] Canonical URLs and duplicate content prevention

## 🔍 **Testing Requirements**

- SEO metadata validation tests
- Structured data validation (Google Rich Results Test)
- Page performance and Core Web Vitals testing
- Mobile usability testing
- Social media sharing preview tests

## 📚 **Dependencies**

```bash
# SEO and meta tag management
npm install next-seo react-helmet-async
npm install next/image next/head

# Performance optimization
npm install @next/bundle-analyzer web-vitals
```

## 🚀 **Expected Outcomes**

- 100+ SEO-optimized course detail pages
- Rich snippet eligibility in search results
- Improved search engine rankings for golf-related queries
- Enhanced social media sharing with proper previews
- Fast page load times and excellent Core Web Vitals scores
- Mobile-first responsive design
- Structured data compliance for better search visibility
- Comprehensive internal linking structure

This PR delivers a complete SEO-optimized page generation system that maximizes search engine visibility and user engagement for all golf course detail pages.