import React, { useState, useEffect, useMemo } from 'react';
import { GetStaticProps, GetStaticPaths, NextPage } from 'next';
import { NextSeo } from 'next-seo';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { AutomatedCourseDetails, WeatherData } from '../../types/quality.types';
import type {
  CoursePageProps,
  SEOMetadata,
  OptimizedContent,
  SocialMetaTags,
  POI
} from '../../types/seo.types';
import { SEOGenerator } from '../../services/seo/seo-generator';
import { StructuredDataGenerator } from '../../services/seo/structured-data-generator';
import { SocialMetaGenerator } from '../../services/seo/social-meta-generator';
import { ContentOptimizer } from '../../services/seo/content-optimizer';
import { CourseHeroImage, CourseGalleryImage } from '../../components/optimized-image';
import logger from '../../utils/logger';

/**
 * Course Detail Page Component
 *
 * Dynamic page for displaying comprehensive golf course information with:
 * - SEO-optimized content and metadata
 * - Structured data markup
 * - Performance-optimized images
 * - Interactive sections and features
 * - Weather integration
 * - Booking and contact information
 */

interface CourseDetailPageProps extends CoursePageProps {
  error?: string;
}

const CourseDetailPage: NextPage<CourseDetailPageProps> = ({
  courseData,
  weatherData,
  nearbyAmenities,
  seoMetadata,
  optimizedContent,
  socialMetaTags,
  error
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Handle loading state
  useEffect(() => {
    const handleRouteChangeStart = () => setIsLoading(true);
    const handleRouteChangeComplete = () => setIsLoading(false);

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router.events]);

  // Generate breadcrumb structured data
  const breadcrumbStructuredData = useMemo(() => {
    if (!seoMetadata.breadcrumbs) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: seoMetadata.breadcrumbs.map((breadcrumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: breadcrumb.name,
        item: breadcrumb.url,
      })),
    };
  }, [seoMetadata.breadcrumbs]);

  // Handle error state
  if (error) {
    return (
      <>
        <NextSeo
          title="Course Not Found | Golf Journey Map"
          description="The requested golf course could not be found."
          noindex={true}
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Course Not Found</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/courses')}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              Browse All Courses
            </button>
          </div>
        </div>
      </>
    );
  }

  // Loading state
  if (isLoading || !courseData) {
    return (
      <div className="min-h-screen">
        <div className="animate-pulse">
          <div className="h-96 bg-gray-300"></div>
          <div className="container mx-auto px-4 py-8">
            <div className="h-8 bg-gray-300 rounded mb-4"></div>
            <div className="h-4 bg-gray-300 rounded mb-2"></div>
            <div className="h-4 bg-gray-300 rounded mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <div className="h-64 bg-gray-300 rounded"></div>
              </div>
              <div className="h-96 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SEO Head Section */}
      <NextSeo
        title={seoMetadata.title}
        description={seoMetadata.description}
        canonical={seoMetadata.canonicalUrl}
        openGraph={{
          title: socialMetaTags.openGraph['og:title'],
          description: socialMetaTags.openGraph['og:description'],
          url: socialMetaTags.openGraph['og:url'],
          type: socialMetaTags.openGraph['og:type'],
          images: [{
            url: socialMetaTags.openGraph['og:image'],
            width: parseInt(socialMetaTags.openGraph['og:image:width']),
            height: parseInt(socialMetaTags.openGraph['og:image:height']),
            alt: socialMetaTags.twitter['twitter:image:alt'],
          }],
          site_name: socialMetaTags.openGraph['og:site_name'],
        }}
        twitter={{
          cardType: socialMetaTags.twitter['twitter:card'] as any,
          title: socialMetaTags.twitter['twitter:title'],
          description: socialMetaTags.twitter['twitter:description'],
          image: socialMetaTags.twitter['twitter:image'],
        }}
        additionalMetaTags={[
          { name: 'keywords', content: seoMetadata.keywords.join(', ') },
          { name: 'geo.region', content: courseData.location },
          { name: 'geo.position', content: `${courseData.latitude};${courseData.longitude}` },
          { name: 'ICBM', content: `${courseData.latitude}, ${courseData.longitude}` },
        ]}
      />

      <Head>
        {/* Golf Course Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(seoMetadata.structuredData.golfCourse),
          }}
        />

        {/* Breadcrumb Structured Data */}
        {breadcrumbStructuredData && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(breadcrumbStructuredData),
            }}
          />
        )}

        {/* Additional Open Graph tags */}
        {Object.entries(socialMetaTags.openGraph).map(([property, content]) => (
          <meta key={property} property={property} content={content} />
        ))}

        {/* Additional Twitter tags */}
        {Object.entries(socialMetaTags.twitter).map(([name, content]) => (
          <meta key={name} name={name} content={content} />
        ))}
      </Head>

      {/* Main Content */}
      <main id="main-content" className="min-h-screen">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="bg-gray-50 py-3">
          <div className="container mx-auto px-4">
            <ol className="flex items-center space-x-2 text-sm">
              {seoMetadata.breadcrumbs.map((breadcrumb, index) => (
                <li key={breadcrumb.position} className="flex items-center">
                  {index > 0 && <span className="mx-2 text-gray-400">/</span>}
                  {index === seoMetadata.breadcrumbs.length - 1 ? (
                    <span className="text-gray-600 font-medium">{breadcrumb.name}</span>
                  ) : (
                    <a
                      href={breadcrumb.url}
                      className="text-green-600 hover:text-green-700 hover:underline"
                    >
                      {breadcrumb.name}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative">
          <CourseHeroImage
            src={courseData.heroImageUrl || '/images/default-golf-course.jpg'}
            alt={`${courseData.name} golf course hero image`}
            courseName={courseData.name}
            className="w-full h-96 md:h-[500px] object-cover"
          />

          {/* Hero Content Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-end">
            <div className="container mx-auto px-4 pb-12">
              <div className="text-white max-w-4xl">
                <h1 className="text-4xl md:text-6xl font-bold mb-4">
                  {optimizedContent.heroSection.headline}
                </h1>
                <p className="text-xl md:text-2xl mb-6 opacity-90">
                  {optimizedContent.heroSection.subheadline}
                </p>

                {/* Key Highlights */}
                {optimizedContent.heroSection.keyHighlights.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-6">
                    {optimizedContent.heroSection.keyHighlights.map((highlight, index) => (
                      <span
                        key={index}
                        className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}

                {/* CTA Button */}
                {courseData.teeTimeBookingUrl && (
                  <a
                    href={courseData.teeTimeBookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
                  >
                    {optimizedContent.heroSection.callToAction}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Container */}
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-12">

              {/* About Section */}
              <section>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">About {courseData.name}</h2>
                <div className="prose prose-lg max-w-none text-gray-700">
                  <p>{optimizedContent.aboutSection.description}</p>
                </div>

                {/* Course Highlights */}
                {optimizedContent.aboutSection.highlights.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Course Highlights</h3>
                    <ul className="space-y-2">
                      {optimizedContent.aboutSection.highlights.map((highlight, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-green-600 mr-2">•</span>
                          <span className="text-gray-700">{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* Course Features */}
              <section>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Course Features</h2>
                <p className="text-gray-700 mb-8">{optimizedContent.featuresSection.overview}</p>

                {/* Specifications Grid */}
                {optimizedContent.featuresSection.specifications.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    {optimizedContent.featuresSection.specifications.map((spec, index) => (
                      <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {spec.value}{spec.unit && ` ${spec.unit}`}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{spec.name}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Amenities */}
                {optimizedContent.featuresSection.amenities.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Amenities</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {optimizedContent.featuresSection.amenities.map((amenity, index) => (
                        <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-2xl mr-3">{amenity.icon || '✓'}</span>
                          <div>
                            <div className="font-medium text-gray-900">{amenity.name}</div>
                            {amenity.description && (
                              <div className="text-sm text-gray-600">{amenity.description}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* History Section */}
              {optimizedContent.historySection.summary && (
                <section>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Course History</h2>
                  <div className="prose prose-lg max-w-none text-gray-700">
                    <p>{optimizedContent.historySection.summary}</p>
                  </div>

                  {/* Timeline */}
                  {optimizedContent.historySection.timeline.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">Timeline</h3>
                      <div className="space-y-4">
                        {optimizedContent.historySection.timeline.map((event, index) => (
                          <div key={index} className="flex items-start">
                            <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-sm mr-4 flex-shrink-0">
                              {event.year}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{event.event}</div>
                              {event.description && (
                                <div className="text-gray-600 text-sm mt-1">{event.description}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Photo Gallery */}
              {courseData.galleryImages && courseData.galleryImages.length > 0 && (
                <section>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Photo Gallery</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {courseData.galleryImages.slice(0, 6).map((image, index) => (
                      <CourseGalleryImage
                        key={index}
                        src={image.url}
                        alt={image.altText || `${courseData.name} photo ${index + 1}`}
                        onClick={() => setSelectedImageIndex(index)}
                        className="aspect-video"
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-8">

              {/* Quick Facts */}
              {optimizedContent.aboutSection.quickFacts.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Facts</h3>
                  <div className="space-y-4">
                    {optimizedContent.aboutSection.quickFacts.map((fact, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{fact.icon}</span>
                          <span className="text-gray-600">{fact.label}</span>
                        </div>
                        <span className="font-medium text-gray-900">{fact.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weather Widget */}
              {optimizedContent.heroSection.weatherWidget && weatherData && (
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Current Weather</h3>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {Math.round(weatherData.current.temperature)}°F
                    </div>
                    <div className="text-gray-600 capitalize">{weatherData.current.description}</div>
                    <div className="text-sm text-gray-500 mt-2">
                      Wind: {weatherData.current.windSpeed} mph
                    </div>
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-3">
                  {courseData.phoneNumber && (
                    <div className="flex items-center">
                      <span className="text-green-600 mr-2">📞</span>
                      <a href={`tel:${courseData.phoneNumber}`} className="text-gray-700 hover:text-green-600">
                        {courseData.phoneNumber}
                      </a>
                    </div>
                  )}

                  {courseData.website && (
                    <div className="flex items-center">
                      <span className="text-green-600 mr-2">🌐</span>
                      <a
                        href={courseData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-green-600"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}

                  <div className="flex items-start">
                    <span className="text-green-600 mr-2 mt-1">📍</span>
                    <span className="text-gray-700">{courseData.location}</span>
                  </div>
                </div>

                {/* Booking Button */}
                {courseData.teeTimeBookingUrl && (
                  <a
                    href={courseData.teeTimeBookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-green-600 hover:bg-green-700 text-white text-center font-semibold py-3 px-4 rounded-lg transition-colors mt-6"
                  >
                    Book Tee Time
                  </a>
                )}
              </div>

              {/* Nearby Amenities */}
              {nearbyAmenities.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Nearby</h3>
                  <div className="space-y-3">
                    {nearbyAmenities.slice(0, 5).map((amenity, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{amenity.name}</div>
                          <div className="text-sm text-gray-600 capitalize">{amenity.type}</div>
                        </div>
                        <div className="text-sm text-gray-500">{amenity.distance.toFixed(1)} mi</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

// Static generation functions
export const getStaticPaths: GetStaticPaths = async () => {
  try {
    // In production, we would generate paths for all courses
    // For development, we'll use fallback: 'blocking' to generate on-demand

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Get all course IDs for static generation
      const courses = await prisma.automatedCourseDetails.findMany({
        select: { id: true, name: true, location: true },
        take: process.env.NODE_ENV === 'production' ? undefined : 10 // Limit in dev
      });

      const { URLGenerator } = await import('../../utils/url-generator');
      const urlGenerator = new URLGenerator(process.env.SITE_URL || 'https://golfjourney.com');

      const paths = courses.map(course => {
        const courseUrl = urlGenerator.generateCourseURL({
          id: course.id,
          name: course.name,
          location: course.location,
          latitude: 0,
          longitude: 0
        } as any);

        // Convert URL to slug array (remove /courses/ prefix)
        const slug = courseUrl.replace('/courses/', '').split('/');

        return {
          params: { slug }
        };
      });

      return {
        paths,
        fallback: 'blocking' // Generate pages on-demand for courses not pre-built
      };
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    logger.error('Error generating static paths', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      paths: [],
      fallback: 'blocking'
    };
  }
};

export const getStaticProps: GetStaticProps<CourseDetailPageProps> = async ({ params }) => {
  try {
    const slug = params?.slug as string[];

    if (!slug || slug.length === 0) {
      return { notFound: true };
    }

    // Try to find course by parsing URL structure
    const { URLGenerator } = await import('../../utils/url-generator');
    const urlGenerator = new URLGenerator(process.env.SITE_URL || 'https://golfjourney.com');

    // Reconstruct URL from slug
    const courseUrl = `/courses/${slug.join('/')}`;
    const parsedInfo = urlGenerator.parseURLToCourseInfo(courseUrl);

    if (!parsedInfo.isValid) {
      return { notFound: true };
    }

    // Import services and generate page data
    const { PrismaClient } = await import('@prisma/client');
    const { SEOGenerator } = await import('../../services/seo/seo-generator');
    const { SocialMetaGenerator } = await import('../../services/seo/social-meta-generator');
    const { ContentOptimizer } = await import('../../services/seo/content-optimizer');
    const { WeatherService } = await import('../../services/weather/weather-service');
    const { OSMService } = await import('../../services/osm/osm-service');

    const prisma = new PrismaClient();

    try {
      // Find course by location and name
      const course = await prisma.automatedCourseDetails.findFirst({
        where: {
          AND: [
            { location: { contains: parsedInfo.state || '', mode: 'insensitive' } },
            { location: { contains: parsedInfo.city || '', mode: 'insensitive' } },
            { name: { contains: parsedInfo.courseName || '', mode: 'insensitive' } }
          ]
        },
        include: {
          galleryImages: true,
          userReviews: true,
        }
      });

      if (!course) {
        return { notFound: true };
      }

      // Initialize services
      const seoConfig = {
        siteName: 'Golf Journey Map',
        siteUrl: process.env.SITE_URL || 'https://golfjourney.com',
        defaultTitle: 'Golf Journey Map',
        defaultDescription: 'Discover Premier Golf Courses',
        defaultKeywords: ['golf', 'golf courses', 'tee times'],
        socialHandles: { twitter: '@golfjourneymap' },
        analytics: { googleAnalytics: process.env.NEXT_PUBLIC_GA_ID },
        structuredData: {
          organization: {
            '@context': 'https://schema.org' as const,
            '@type': 'Organization' as const,
            name: 'Golf Journey Map',
            url: process.env.SITE_URL || 'https://golfjourney.com',
            logo: `${process.env.SITE_URL || 'https://golfjourney.com'}/images/logo.png`,
            sameAs: [
              'https://twitter.com/golfjourneymap',
              'https://facebook.com/golfjourneymap',
              'https://instagram.com/golfjourneymap',
            ],
          },
        },
      };

      const seoGenerator = new SEOGenerator(seoConfig);
      const socialMetaGenerator = new SocialMetaGenerator(seoConfig);
      const contentOptimizer = new ContentOptimizer();
      const weatherService = new WeatherService();
      const osmService = new OSMService();

      // Generate all required data
      const seoMetadata = seoGenerator.generateCoursePageSEO(course);
      const optimizedContent = contentOptimizer.optimizeContentForSEO(course, {
        includeWeather: true,
        includeHistory: true,
        includeNearbyAmenities: true,
        optimizeForKeywords: true,
        generateAltText: true,
        minContentLength: 300,
        maxContentLength: 1500
      });

      // Fetch weather data if coordinates are available
      let weatherData = null;
      if (course.latitude && course.longitude) {
        try {
          weatherData = await weatherService.getCurrentWeather(course.latitude, course.longitude);
        } catch (error) {
          logger.warn('Failed to fetch weather data', { courseId: course.id });
        }
      }

      // Fetch nearby amenities if coordinates are available
      let nearbyAmenities: POI[] = [];
      if (course.latitude && course.longitude) {
        try {
          const osmPOIs = await osmService.getNearbyPOIs(course.latitude, course.longitude, 5000);
          nearbyAmenities = osmPOIs.map((amenity): POI => ({
            id: amenity.id,
            name: amenity.name,
            type: amenity.type as POI['type'],
            distance: amenity.distance,
            coordinates: [amenity.longitude, amenity.latitude],
            address: amenity.address,
            rating: amenity.rating,
            description: amenity.description
          }));
        } catch (error) {
          logger.warn('Failed to fetch nearby amenities', { courseId: course.id });
        }
      }

      // Generate social meta tags
      const socialMetaTags = socialMetaGenerator.generateSocialTags(course, seoMetadata);

      return {
        props: {
          courseData: {
            ...course,
            galleryImages: course.galleryImages || [],
            userReviews: course.userReviews || []
          },
          weatherData: weatherData || undefined,
          nearbyAmenities,
          seoMetadata,
          optimizedContent,
          socialMetaTags
        },
        revalidate: 3600 // Revalidate every hour
      };

    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    logger.error('Error generating course page props', {
      params,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      props: {
        error: 'Failed to load course data. Please try again later.'
      }
    };
  }
};

export default CourseDetailPage;