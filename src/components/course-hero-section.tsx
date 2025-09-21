import React from 'react';
import type { AutomatedCourseDetails, WeatherData } from '../types/quality.types';
import type { HeroContent } from '../types/seo.types';
import { CourseHeroImage } from './optimized-image';

interface CourseHeroSectionProps {
  course: AutomatedCourseDetails;
  heroContent: HeroContent;
  weatherData?: WeatherData;
}

/**
 * Course Hero Section Component
 *
 * Displays the main hero image and key course information including:
 * - High-impact hero image with proper optimization
 * - Course name and compelling headline
 * - Key highlights and selling points
 * - Call-to-action for booking
 * - Optional weather widget integration
 */
export const CourseHeroSection: React.FC<CourseHeroSectionProps> = ({
  course,
  heroContent,
  weatherData
}) => {
  return (
    <section className="relative" role="banner">
      {/* Hero Image */}
      <CourseHeroImage
        src={course.heroImageUrl || '/images/default-golf-course.jpg'}
        alt={`${course.name} golf course - ${heroContent.subheadline}`}
        courseName={course.name}
        className="w-full h-96 md:h-[500px] lg:h-[600px] object-cover"
      />

      {/* Gradient Overlay for Better Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>

      {/* Hero Content */}
      <div className="absolute inset-0 flex items-end">
        <div className="container mx-auto px-4 pb-12 md:pb-16">
          <div className="text-white max-w-5xl">

            {/* Main Headline */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
              {heroContent.headline}
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl lg:text-2xl mb-6 opacity-90 max-w-3xl">
              {heroContent.subheadline}
            </p>

            {/* Key Highlights */}
            {heroContent.keyHighlights.length > 0 && (
              <div className="flex flex-wrap gap-2 md:gap-3 mb-8">
                {heroContent.keyHighlights.map((highlight, index) => (
                  <span
                    key={index}
                    className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-3 md:px-4 py-2 text-sm md:text-base font-medium border border-white border-opacity-30"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              {course.teeTimeBookingUrl && (
                <a
                  href={course.teeTimeBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-semibold px-6 md:px-8 py-3 md:py-4 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                  aria-label={`Book tee time at ${course.name}`}
                >
                  <span className="mr-2">⛳</span>
                  {heroContent.callToAction}
                </a>
              )}

              {course.website && (
                <a
                  href={course.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 text-white font-semibold px-6 md:px-8 py-3 md:py-4 rounded-lg transition-all duration-200 border border-white border-opacity-30"
                  aria-label={`Visit ${course.name} website`}
                >
                  <span className="mr-2">🌐</span>
                  Visit Website
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Weather Widget Overlay */}
      {heroContent.weatherWidget && weatherData && (
        <div className="absolute top-4 right-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">
              {Math.round(weatherData.current.temperature)}°F
            </div>
            <div className="text-sm text-gray-600 capitalize">
              {weatherData.current.description}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Wind: {weatherData.current.windSpeed} mph
            </div>
          </div>
        </div>
      )}

      {/* Course Rating Badge */}
      {course.averageRating && course.averageRating > 0 && (
        <div className="absolute top-4 left-4 bg-yellow-500 text-white rounded-lg px-3 py-2 shadow-lg">
          <div className="flex items-center">
            <span className="text-lg mr-1">⭐</span>
            <span className="font-bold">{course.averageRating.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* Championship Badge */}
      {course.majorChampionships && course.majorChampionships.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-red-600 text-white rounded-lg px-4 py-2 shadow-lg">
          <div className="text-sm font-semibold">
            🏆 {course.majorChampionships[0]} Host
          </div>
        </div>
      )}
    </section>
  );
};