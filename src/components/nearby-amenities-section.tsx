import React from 'react';
import type { POI, LocationContent } from '../types/seo.types';

interface NearbyAmenitiesSectionProps {
  amenities: POI[];
  locationContent: LocationContent;
  courseName: string;
}

/**
 * Nearby Amenities Section Component
 *
 * Displays nearby points of interest and amenities including:
 * - Hotels and accommodations
 * - Restaurants and dining options
 * - Shopping and entertainment
 * - Transportation and services
 * - Distance and contact information
 */
export const NearbyAmenitiesSection: React.FC<NearbyAmenitiesSectionProps> = ({
  amenities,
  locationContent,
  courseName
}) => {
  // Don't render if no amenities
  if (!amenities || amenities.length === 0) {
    return null;
  }

  // Group amenities by type
  const groupedAmenities = amenities.reduce((groups, amenity) => {
    const type = amenity.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(amenity);
    return groups;
  }, {} as Record<string, POI[]>);

  // Icon mapping for different amenity types
  const getIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      restaurant: '🍽️',
      hotel: '🏨',
      attraction: '🎯',
      shopping: '🛍️',
      gas_station: '⛽',
      hospital: '🏥',
      parking: '🅿️',
      airport: '✈️',
      bank: '🏦',
      pharmacy: '💊',
      gym: '💪',
      spa: '🧖‍♀️'
    };
    return iconMap[type] || '📍';
  };

  // Type display names
  const getTypeName = (type: string): string => {
    const typeNames: Record<string, string> = {
      restaurant: 'Dining',
      hotel: 'Accommodation',
      attraction: 'Attractions',
      shopping: 'Shopping',
      gas_station: 'Gas Stations',
      hospital: 'Medical',
      parking: 'Parking',
      airport: 'Transportation',
      bank: 'Banking',
      pharmacy: 'Pharmacy',
      gym: 'Fitness',
      spa: 'Wellness'
    };
    return typeNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Sort groups by priority
  const typeOrder = ['hotel', 'restaurant', 'attraction', 'shopping', 'gas_station', 'hospital'];
  const sortedTypes = Object.keys(groupedAmenities).sort((a, b) => {
    const indexA = typeOrder.indexOf(a);
    const indexB = typeOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <section className="py-12 md:py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">

          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Nearby Amenities
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {locationContent.summary}
            </p>
          </div>

          {/* Location Overview */}
          {locationContent.directions && (
            <div className="bg-white rounded-xl p-6 md:p-8 mb-12 shadow-sm">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4">
                Location & Directions
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-start mb-4">
                    <span className="text-blue-600 mr-3 text-xl flex-shrink-0">📍</span>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Address</h4>
                      <p className="text-gray-700">{locationContent.directions.address}</p>
                    </div>
                  </div>
                  {locationContent.directions.drivingDirections && (
                    <div className="flex items-start">
                      <span className="text-blue-600 mr-3 text-xl flex-shrink-0">🚗</span>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">Driving Directions</h4>
                        <p className="text-gray-700">{locationContent.directions.drivingDirections}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  {locationContent.directions.publicTransport && (
                    <div className="flex items-start mb-4">
                      <span className="text-blue-600 mr-3 text-xl flex-shrink-0">🚌</span>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">Public Transportation</h4>
                        <p className="text-gray-700">{locationContent.directions.publicTransport}</p>
                      </div>
                    </div>
                  )}
                  {locationContent.directions.coordinates && (
                    <div className="flex items-start">
                      <span className="text-blue-600 mr-3 text-xl flex-shrink-0">🗺️</span>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">GPS Coordinates</h4>
                        <p className="text-gray-700 font-mono text-sm">
                          {locationContent.directions.coordinates[1]}, {locationContent.directions.coordinates[0]}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Amenities by Category */}
          <div className="space-y-8">
            {sortedTypes.map((type) => (
              <div key={type} className="bg-white rounded-xl p-6 md:p-8 shadow-sm">
                <div className="flex items-center mb-6">
                  <span className="text-3xl mr-3">{getIcon(type)}</span>
                  <h3 className="text-xl md:text-2xl font-semibold text-gray-900">
                    {getTypeName(type)}
                  </h3>
                  <span className="ml-3 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm">
                    {groupedAmenities[type].length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedAmenities[type].map((amenity, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 flex-1 pr-2">
                          {amenity.name}
                        </h4>
                        <span className="text-sm text-green-600 font-medium flex-shrink-0">
                          {amenity.distance.toFixed(1)} mi
                        </span>
                      </div>

                      {amenity.address && (
                        <p className="text-sm text-gray-600 mb-2">
                          {amenity.address}
                        </p>
                      )}

                      {amenity.description && (
                        <p className="text-sm text-gray-700 mb-3">
                          {amenity.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        {amenity.rating && (
                          <div className="flex items-center">
                            <span className="text-yellow-500 mr-1">⭐</span>
                            <span className="text-sm font-medium text-gray-700">
                              {amenity.rating.toFixed(1)}
                            </span>
                          </div>
                        )}

                        {/* Google Maps Link */}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(amenity.name + ' ' + (amenity.address || ''))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          aria-label={`Get directions to ${amenity.name}`}
                        >
                          Directions
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Area Attractions */}
          {locationContent.nearbyAttractions && locationContent.nearbyAttractions.length > 0 && (
            <div className="mt-12 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 md:p-8">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-6 text-center">
                Local Attractions & Activities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {locationContent.nearbyAttractions.map((attraction, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center mb-3">
                      <span className="text-2xl mr-3">🎯</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{attraction.name}</h4>
                        <p className="text-sm text-green-600">{attraction.distance}</p>
                      </div>
                    </div>
                    {attraction.description && (
                      <p className="text-gray-700 text-sm">{attraction.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Call to Action */}
          <div className="mt-12 text-center">
            <div className="bg-green-600 text-white rounded-xl p-6 md:p-8">
              <h3 className="text-xl md:text-2xl font-bold mb-4">
                Plan Your Golf Getaway
              </h3>
              <p className="text-green-100 mb-6 max-w-2xl mx-auto">
                With excellent amenities and attractions nearby, {courseName} is the perfect destination
                for a golf vacation. Book your tee time and explore everything the area has to offer.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="bg-white text-green-600 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors">
                  View Hotels
                </button>
                <button className="bg-green-700 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-800 transition-colors">
                  Find Restaurants
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};