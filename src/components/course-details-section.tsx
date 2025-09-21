import React from 'react';
import type { AutomatedCourseDetails } from '../types/quality.types';
import type { AboutContent, FeaturesContent } from '../types/seo.types';

interface CourseDetailsSectionProps {
  course: AutomatedCourseDetails;
  aboutContent: AboutContent;
  featuresContent: FeaturesContent;
}

/**
 * Course Details Section Component
 *
 * Displays comprehensive course information including:
 * - Course description and overview
 * - Key highlights and features
 * - Technical specifications
 * - Course amenities and facilities
 */
export const CourseDetailsSection: React.FC<CourseDetailsSectionProps> = ({
  course,
  aboutContent,
  featuresContent
}) => {
  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">

          {/* About Section */}
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              About {course.name}
            </h2>

            <div className="prose prose-lg md:prose-xl max-w-none text-gray-700 leading-relaxed">
              <p>{aboutContent.description}</p>
            </div>

            {/* Course Highlights */}
            {aboutContent.highlights.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4">
                  What Makes This Course Special
                </h3>
                <div className="grid gap-4 md:gap-6">
                  {aboutContent.highlights.map((highlight, index) => (
                    <div key={index} className="flex items-start bg-green-50 rounded-lg p-4">
                      <div className="bg-green-600 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mr-4 mt-1">
                        <span className="text-white text-sm">✓</span>
                      </div>
                      <p className="text-gray-700 font-medium">{highlight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Course Features */}
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Course Features & Specifications
            </h2>

            <p className="text-gray-700 text-lg mb-8 leading-relaxed">
              {featuresContent.overview}
            </p>

            {/* Specifications Grid */}
            {featuresContent.specifications.length > 0 && (
              <div className="mb-10">
                <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-6">
                  Course Specifications
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  {featuresContent.specifications.map((spec, index) => (
                    <div key={index} className="text-center p-6 bg-gray-50 rounded-xl hover:shadow-md transition-shadow">
                      <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">
                        {spec.value}{spec.unit && ` ${spec.unit}`}
                      </div>
                      <div className="text-sm md:text-base text-gray-600 font-medium">
                        {spec.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities */}
            {featuresContent.amenities.length > 0 && (
              <div>
                <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-6">
                  Facilities & Amenities
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {featuresContent.amenities.map((amenity, index) => (
                    <div key={index} className="flex items-start p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="text-2xl md:text-3xl mr-4 flex-shrink-0">
                        {amenity.icon || '✅'}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">
                          {amenity.name}
                        </h4>
                        {amenity.description && (
                          <p className="text-sm md:text-base text-gray-600">
                            {amenity.description}
                          </p>
                        )}
                        <div className="mt-2">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            amenity.available
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {amenity.available ? 'Available' : 'Not Available'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Additional Course Information */}
          <div className="bg-blue-50 rounded-xl p-6 md:p-8">
            <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4">
              Course Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Left Column */}
              <div className="space-y-4">
                {course.architect && (
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3 text-lg">🏗️</span>
                    <div>
                      <span className="font-medium text-gray-900">Architect:</span>
                      <span className="ml-2 text-gray-700">{course.architect}</span>
                    </div>
                  </div>
                )}

                {course.openingYear && (
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3 text-lg">📅</span>
                    <div>
                      <span className="font-medium text-gray-900">Opened:</span>
                      <span className="ml-2 text-gray-700">{course.openingYear}</span>
                    </div>
                  </div>
                )}

                {course.courseType && (
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3 text-lg">🏌️</span>
                    <div>
                      <span className="font-medium text-gray-900">Course Type:</span>
                      <span className="ml-2 text-gray-700">{course.courseType}</span>
                    </div>
                  </div>
                )}

                {course.publicAccess !== undefined && (
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3 text-lg">🌐</span>
                    <div>
                      <span className="font-medium text-gray-900">Access:</span>
                      <span className="ml-2 text-gray-700">
                        {course.publicAccess ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {course.greensFeePriceRange && (
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3 text-lg">💰</span>
                    <div>
                      <span className="font-medium text-gray-900">Greens Fee:</span>
                      <span className="ml-2 text-gray-700">{course.greensFeePriceRange}</span>
                    </div>
                  </div>
                )}

                {course.courseRating && (
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3 text-lg">⭐</span>
                    <div>
                      <span className="font-medium text-gray-900">Course Rating:</span>
                      <span className="ml-2 text-gray-700">{course.courseRating}</span>
                    </div>
                  </div>
                )}

                {course.slopeRating && (
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3 text-lg">📈</span>
                    <div>
                      <span className="font-medium text-gray-900">Slope Rating:</span>
                      <span className="ml-2 text-gray-700">{course.slopeRating}</span>
                    </div>
                  </div>
                )}

                {course.cartRequired !== undefined && (
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3 text-lg">🛒</span>
                    <div>
                      <span className="font-medium text-gray-900">Cart:</span>
                      <span className="ml-2 text-gray-700">
                        {course.cartRequired ? 'Required' : 'Optional'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};