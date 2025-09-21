import React from 'react';
import type { AutomatedCourseDetails } from '../types/quality.types';
import type { HistoryContent } from '../types/seo.types';

interface CourseHistorySectionProps {
  course: AutomatedCourseDetails;
  historyContent: HistoryContent;
}

/**
 * Course History Section Component
 *
 * Displays the historical information about the golf course including:
 * - Course history summary and background
 * - Timeline of major events and milestones
 * - Notable championships and tournaments
 * - Renovations and significant changes
 */
export const CourseHistorySection: React.FC<CourseHistorySectionProps> = ({
  course,
  historyContent
}) => {
  // Don't render if no history content
  if (!historyContent.summary && historyContent.timeline.length === 0 && historyContent.notableEvents.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">

          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Course History & Heritage
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Discover the rich history and tradition behind {course.name}
            </p>
          </div>

          {/* History Summary */}
          {historyContent.summary && (
            <div className="mb-12">
              <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm">
                <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4">
                  Our Story
                </h3>
                <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                  <p>{historyContent.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          {historyContent.timeline.length > 0 && (
            <div className="mb-12">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-8 text-center">
                Historical Timeline
              </h3>
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-4 md:left-1/2 transform md:-translate-x-1/2 top-0 bottom-0 w-0.5 bg-green-300"></div>

                <div className="space-y-8">
                  {historyContent.timeline.map((event, index) => (
                    <div key={index} className={`relative flex items-center ${
                      index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                    }`}>
                      {/* Timeline Dot */}
                      <div className="absolute left-4 md:left-1/2 transform md:-translate-x-1/2 w-3 h-3 bg-green-600 rounded-full border-4 border-white shadow-md z-10"></div>

                      {/* Content Card */}
                      <div className={`flex-1 ml-12 md:ml-0 ${
                        index % 2 === 0 ? 'md:pr-8' : 'md:pl-8'
                      }`}>
                        <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center mb-3">
                            <div className="bg-green-600 text-white rounded-full px-3 py-1 text-sm font-bold mr-3">
                              {event.year}
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900">
                              {event.event}
                            </h4>
                          </div>
                          {event.description && (
                            <p className="text-gray-600 leading-relaxed">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notable Events */}
          {historyContent.notableEvents.length > 0 && (
            <div className="mb-12">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-6">
                Notable Achievements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historyContent.notableEvents.map((event, index) => (
                  <div key={index} className="flex items-center bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-yellow-100 rounded-full p-3 mr-4 flex-shrink-0">
                      <span className="text-yellow-600 text-xl">🏆</span>
                    </div>
                    <p className="text-gray-700 font-medium">{event}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Championship History */}
          {course.majorChampionships && course.majorChampionships.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 md:p-8">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-6 text-center">
                Championship Heritage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {course.majorChampionships.map((championship, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-3xl mb-2">🏆</div>
                    <h4 className="font-semibold text-gray-900 mb-1">{championship}</h4>
                    <p className="text-sm text-gray-600">Championship Host</p>
                  </div>
                ))}
              </div>
              <div className="text-center mt-6">
                <p className="text-gray-700 italic">
                  {course.name} has proudly hosted {course.majorChampionships.length} major championship{course.majorChampionships.length > 1 ? 's' : ''},
                  cementing its place among golf's most prestigious venues.
                </p>
              </div>
            </div>
          )}

          {/* Architect Spotlight */}
          {course.architect && (
            <div className="mt-12 bg-white rounded-xl p-6 md:p-8 shadow-sm">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4">
                Architect: {course.architect}
              </h3>
              <div className="flex items-start">
                <div className="bg-blue-100 rounded-full p-3 mr-4 flex-shrink-0">
                  <span className="text-blue-600 text-xl">🏗️</span>
                </div>
                <div>
                  <p className="text-gray-700 leading-relaxed">
                    {course.architect} designed this exceptional golf course, bringing their unique vision and
                    expertise to create a layout that challenges and inspires golfers of all skill levels.
                    The thoughtful design showcases the natural beauty of the landscape while providing
                    strategic elements that make each round memorable.
                  </p>
                  {course.openingYear && (
                    <p className="text-sm text-gray-600 mt-3">
                      Course opened: {course.openingYear}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};