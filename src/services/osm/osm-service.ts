import type { AxiosResponse } from 'axios';
import axios from 'axios';
import type {
  OSMCourseData,
  OverpassResponse,
  POI,
  OSMNode,
  OSMWay,
  OSMRelation,
  APIResponse,
  APIError,
} from '../../types/api.types';
import { apiLogger } from '../../utils/logger';
import config from '../../config/config';

interface NominatimResponse {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  boundingbox: [string, string, string, string];
}

export class OSMService {
  private readonly overpassUrl = 'https://overpass-api.de/api/interpreter';
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org/search';
  private readonly timeout: number;
  private requestCount = 0;
  private lastReset = Date.now();

  constructor() {
    this.timeout = config.scraping.timeoutMs;
    apiLogger.info('OSMService initialized');
  }

  /**
   * Find golf course location using Overpass API
   */
  async findCourseLocation(
    courseName: string,
    city: string,
    state: string,
  ): Promise<APIResponse<OSMCourseData | null>> {
    const requestId = `osm-course-${Date.now()}`;
    const startTime = Date.now();

    try {
      await this.checkRateLimit();

      apiLogger.info(`Finding course location: ${courseName}`, {
        requestId,
        city,
        state,
      });

      // Create multiple search strategies
      const searchStrategies = [
        this.createCourseQuery(courseName, city, state, 'exact'),
        this.createCourseQuery(courseName, city, state, 'fuzzy'),
        this.createLocationQuery(city, state),
      ];

      for (let i = 0; i < searchStrategies.length; i++) {
        const query = searchStrategies[i];

        try {
          const response: AxiosResponse<OverpassResponse> = await axios.post(
            this.overpassUrl,
            query,
            {
              timeout: this.timeout,
              headers: {
                'Content-Type': 'text/plain',
                'User-Agent': config.scraping.userAgent,
              },
            },
          );

          this.incrementRequestCount();

          if (response.data.elements && response.data.elements.length > 0) {
            const courseData = await this.processCourseLocation(response.data, courseName);

            if (courseData) {
              const processingTime = Date.now() - startTime;

              apiLogger.info(`Found course location via strategy ${i + 1}`, {
                requestId,
                processingTime,
                courseName,
                coordinates: courseData.coordinates,
                strategy: i + 1,
              });

              return {
                success: true,
                data: courseData,
                cached: false,
                requestId,
                processingTime,
              };
            }
          }

          // Small delay between attempts
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (strategyError) {
          apiLogger.warn(`Strategy ${i + 1} failed for ${courseName}`, strategyError);
          continue; // Try next strategy
        }
      }

      // Fallback to Nominatim geocoding
      const nominatimResult = await this.fallbackToNominatim(courseName, city, state);

      if (nominatimResult.success && nominatimResult.data) {
        return nominatimResult;
      }

      // No location found
      const processingTime = Date.now() - startTime;

      apiLogger.info(`No location found for: ${courseName}`, {
        requestId,
        processingTime,
        city,
        state,
      });

      return {
        success: true,
        data: null,
        cached: false,
        requestId,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const apiError = this.createAPIError('findCourseLocation', error);

      apiLogger.error('Failed to find course location', error, {
        requestId,
        courseName,
        city,
        state,
        processingTime,
      });

      return {
        success: false,
        error: apiError,
        cached: false,
        requestId,
        processingTime,
      };
    }
  }

  /**
   * Get nearby amenities for a location
   */
  async getNearbyAmenities(
    lat: number,
    lon: number,
    radiusKm: number = 10,
  ): Promise<APIResponse<POI[]>> {
    const requestId = `osm-amenities-${Date.now()}`;
    const startTime = Date.now();

    try {
      await this.checkRateLimit();

      apiLogger.info(`Finding nearby amenities`, {
        requestId,
        coordinates: `${lat}, ${lon}`,
        radius: radiusKm,
      });

      const query = this.createAmenitiesQuery(lat, lon, radiusKm);

      const response: AxiosResponse<OverpassResponse> = await axios.post(this.overpassUrl, query, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': config.scraping.userAgent,
        },
      });

      this.incrementRequestCount();

      const amenities = this.processNearbyAmenities(response.data, lat, lon);
      const processingTime = Date.now() - startTime;

      apiLogger.info(`Found ${amenities.length} nearby amenities`, {
        requestId,
        processingTime,
        coordinates: `${lat}, ${lon}`,
        amenityCount: amenities.length,
      });

      return {
        success: true,
        data: amenities,
        cached: false,
        requestId,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const apiError = this.createAPIError('getNearbyAmenities', error);

      apiLogger.error('Failed to get nearby amenities', error, {
        requestId,
        coordinates: `${lat}, ${lon}`,
        radius: radiusKm,
        processingTime,
      });

      return {
        success: false,
        error: apiError,
        cached: false,
        requestId,
        processingTime,
      };
    }
  }

  /**
   * Get detailed course information including boundaries and features
   */
  async getCourseDetails(
    lat: number,
    lon: number,
    radiusM: number = 2000,
  ): Promise<APIResponse<Partial<OSMCourseData>>> {
    const requestId = `osm-details-${Date.now()}`;
    const startTime = Date.now();

    try {
      await this.checkRateLimit();

      apiLogger.info(`Getting course details`, {
        requestId,
        coordinates: `${lat}, ${lon}`,
        radius: radiusM,
      });

      const query = this.createCourseDetailsQuery(lat, lon, radiusM);

      const response: AxiosResponse<OverpassResponse> = await axios.post(this.overpassUrl, query, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': config.scraping.userAgent,
        },
      });

      this.incrementRequestCount();

      const details = this.processCourseDetails(response.data);
      const processingTime = Date.now() - startTime;

      apiLogger.info(`Extracted course details`, {
        requestId,
        processingTime,
        features: details.features?.length || 0,
        amenities: details.amenities?.length || 0,
      });

      return {
        success: true,
        data: details,
        cached: false,
        requestId,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const apiError = this.createAPIError('getCourseDetails', error);

      apiLogger.error('Failed to get course details', error, {
        requestId,
        coordinates: `${lat}, ${lon}`,
        radius: radiusM,
        processingTime,
      });

      return {
        success: false,
        error: apiError,
        cached: false,
        requestId,
        processingTime,
      };
    }
  }

  /**
   * Create Overpass query for course search
   */
  private createCourseQuery(
    courseName: string,
    city: string,
    state: string,
    strategy: 'exact' | 'fuzzy' | 'location',
  ): string {
    const escapedName = courseName.replace(/"/g, '\\"');

    switch (strategy) {
      case 'exact':
        return `
          [out:json][timeout:25];
          (
            way["leisure"="golf_course"]["name"~"^${escapedName}$",i];
            relation["leisure"="golf_course"]["name"~"^${escapedName}$",i];
          );
          out geom;
        `;

      case 'fuzzy':
        const nameWords = courseName.split(' ').filter((word) => word.length > 2);
        const fuzzyPattern = nameWords.join('.*');
        return `
          [out:json][timeout:25];
          (
            way["leisure"="golf_course"]["name"~"${fuzzyPattern}",i];
            relation["leisure"="golf_course"]["name"~"${fuzzyPattern}",i];
          );
          out geom;
        `;

      default:
        return `
          [out:json][timeout:25];
          (
            way["leisure"="golf_course"];
            relation["leisure"="golf_course"];
          );
          out geom;
        `;
    }
  }

  /**
   * Create location-based query
   */
  private createLocationQuery(city: string, state: string): string {
    return `
      [out:json][timeout:25];
      area["name"="${state}"]["admin_level"="4"]->.state;
      area["name"="${city}"]["admin_level"~"[678]"](area.state)->.city;
      (
        way["leisure"="golf_course"](area.city);
        relation["leisure"="golf_course"](area.city);
      );
      out geom;
    `;
  }

  /**
   * Create amenities query
   */
  private createAmenitiesQuery(lat: number, lon: number, radiusKm: number): string {
    const radiusM = radiusKm * 1000;

    return `
      [out:json][timeout:25];
      (
        node["tourism"="hotel"](around:${radiusM},${lat},${lon});
        node["amenity"="restaurant"](around:${radiusM},${lat},${lon});
        node["aeroway"="aerodrome"](around:${radiusM},${lat},${lon});
        node["tourism"="attraction"](around:${radiusM},${lat},${lon});
        way["tourism"="hotel"](around:${radiusM},${lat},${lon});
        way["amenity"="restaurant"](around:${radiusM},${lat},${lon});
        way["aeroway"="aerodrome"](around:${radiusM},${lat},${lon});
      );
      out center;
    `;
  }

  /**
   * Create course details query
   */
  private createCourseDetailsQuery(lat: number, lon: number, radiusM: number): string {
    return `
      [out:json][timeout:25];
      (
        way["leisure"="golf_course"](around:${radiusM},${lat},${lon});
        relation["leisure"="golf_course"](around:${radiusM},${lat},${lon});
        node["sport"="golf"](around:${radiusM},${lat},${lon});
        way["sport"="golf"](around:${radiusM},${lat},${lon});
        node["amenity"="parking"](around:${radiusM},${lat},${lon});
        node["amenity"="restaurant"](around:${radiusM},${lat},${lon});
        node["amenity"="toilets"](around:${radiusM},${lat},${lon});
        node["shop"="golf"](around:${radiusM},${lat},${lon});
      );
      out geom;
    `;
  }

  /**
   * Process course location data from Overpass response
   */
  private async processCourseLocation(
    data: OverpassResponse,
    targetCourseName: string,
  ): Promise<OSMCourseData | null> {
    if (!data.elements || data.elements.length === 0) {
      return null;
    }

    // Find the best matching course
    const golfCourses = data.elements.filter(
      (element) => element.tags && element.tags.leisure === 'golf_course',
    );

    if (golfCourses.length === 0) {
      return null;
    }

    // Score courses by name similarity
    const scoredCourses = golfCourses.map((course) => {
      const name = course.tags?.name || '';
      const similarity = this.calculateNameSimilarity(name, targetCourseName);
      return { course, similarity };
    });

    const bestMatch = scoredCourses
      .filter((item) => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)[0];

    if (!bestMatch) {
      return null;
    }

    const course = bestMatch.course;

    // Calculate center coordinates
    const coordinates = this.calculateElementCenter(course);

    if (!coordinates) {
      return null;
    }

    // Extract address information
    const address = this.extractAddressFromTags(course.tags || {});

    // Extract course features
    const amenities = this.extractCourseAmenities(course.tags || {});
    const features = this.extractCourseFeatures(course.tags || {});

    return {
      coordinates,
      address,
      amenities,
      features,
      nearbyFeatures: {
        hotels: [],
        restaurants: [],
        airports: [],
        attractions: [],
      },
      accessibility: {
        wheelchair: course.tags?.wheelchair === 'yes',
        parking: course.tags?.parking === 'yes',
        publicTransport: [],
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Process nearby amenities
   */
  private processNearbyAmenities(
    data: OverpassResponse,
    centerLat: number,
    centerLon: number,
  ): POI[] {
    const pois: POI[] = [];

    data.elements.forEach((element) => {
      const coordinates = this.calculateElementCenter(element);
      if (!coordinates) return;

      const distance = this.calculateDistance(centerLat, centerLon, coordinates[1], coordinates[0]);

      const poi: POI = {
        id: `${element.type}-${element.id}`,
        name: element.tags?.name || 'Unknown',
        type: this.determinePoiType(element.tags || {}),
        coordinates,
        distance: Math.round(distance),
        tags: element.tags || {},
      };

      // Add additional information if available
      if (element.tags?.phone) poi.phone = element.tags.phone;
      if (element.tags?.website) poi.website = element.tags.website;
      if (element.tags?.['addr:full']) poi.address = element.tags['addr:full'];

      pois.push(poi);
    });

    // Sort by distance and limit results
    return pois.sort((a, b) => a.distance - b.distance).slice(0, 50); // Limit to 50 nearest POIs
  }

  /**
   * Process course details
   */
  private processCourseDetails(data: OverpassResponse): Partial<OSMCourseData> {
    const result: Partial<OSMCourseData> = {
      amenities: [],
      features: [],
      accessibility: {
        wheelchair: false,
        parking: false,
        publicTransport: [],
      },
    };

    const amenities = new Set<string>();
    const features = new Set<string>();

    data.elements.forEach((element) => {
      if (!element.tags) return;

      // Collect amenities
      if (element.tags.amenity) {
        amenities.add(element.tags.amenity);
      }

      // Collect features
      if (element.tags.sport === 'golf') {
        features.add('Golf facilities');
      }

      if (element.tags.leisure === 'golf_course') {
        features.add('Golf course');
      }

      // Check accessibility
      if (element.tags.wheelchair === 'yes') {
        result.accessibility!.wheelchair = true;
      }

      if (element.tags.amenity === 'parking') {
        result.accessibility!.parking = true;
      }
    });

    result.amenities = Array.from(amenities);
    result.features = Array.from(features);

    return result;
  }

  /**
   * Fallback to Nominatim geocoding
   */
  private async fallbackToNominatim(
    courseName: string,
    city: string,
    state: string,
  ): Promise<APIResponse<OSMCourseData | null>> {
    try {
      await this.checkRateLimit('nominatim');

      const query = `${courseName} golf course ${city} ${state}`;

      const response: AxiosResponse<NominatimResponse[]> = await axios.get(this.nominatimUrl, {
        params: {
          q: query,
          format: 'json',
          addressdetails: 1,
          limit: 5,
        },
        timeout: this.timeout,
        headers: {
          'User-Agent': config.scraping.userAgent,
        },
      });

      if (response.data && response.data.length > 0) {
        const best = response.data[0];

        const courseData: OSMCourseData = {
          coordinates: [parseFloat(best.lon), parseFloat(best.lat)],
          address: {
            street: best.address?.road,
            city: best.address?.city,
            state: best.address?.state,
            country: best.address?.country,
            postalCode: best.address?.postcode,
          },
          amenities: [],
          features: [],
          nearbyFeatures: {
            hotels: [],
            restaurants: [],
            airports: [],
            attractions: [],
          },
          accessibility: {
            wheelchair: false,
            parking: false,
            publicTransport: [],
          },
          lastUpdated: new Date(),
        };

        apiLogger.info(`Found location via Nominatim fallback: ${courseName}`, {
          coordinates: courseData.coordinates,
          address: best.display_name,
        });

        return {
          success: true,
          data: courseData,
          cached: false,
          requestId: `nominatim-${Date.now()}`,
          processingTime: 0,
        };
      }

      return {
        success: true,
        data: null,
        cached: false,
        requestId: `nominatim-${Date.now()}`,
        processingTime: 0,
      };
    } catch (error) {
      apiLogger.warn('Nominatim fallback failed', error);
      return {
        success: false,
        error: this.createAPIError('fallbackToNominatim', error),
        cached: false,
        requestId: `nominatim-error-${Date.now()}`,
        processingTime: 0,
      };
    }
  }

  /**
   * Calculate element center coordinates
   */
  private calculateElementCenter(element: OSMNode | OSMWay | OSMRelation): [number, number] | null {
    if (element.type === 'node') {
      const node = element as OSMNode;
      return [node.lon, node.lat];
    }

    if (element.type === 'way') {
      const way = element as OSMWay;
      if (way.geometry && way.geometry.length > 0) {
        const lats = way.geometry.map((coord) => coord.lat);
        const lons = way.geometry.map((coord) => coord.lon);

        const centerLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
        const centerLon = lons.reduce((sum, lon) => sum + lon, 0) / lons.length;

        return [centerLon, centerLat];
      }
    }

    // For relations or elements without geometry, we can't determine center
    return null;
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate name similarity
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const n1 = normalize(name1);
    const n2 = normalize(name2);

    if (n1 === n2) return 1.0;

    const words1 = n1.split(' ');
    const words2 = n2.split(' ');

    const commonWords = words1.filter((word) => words2.includes(word)).length;
    const totalWords = Math.max(words1.length, words2.length);

    return commonWords / totalWords;
  }

  /**
   * Extract address from OSM tags
   */
  private extractAddressFromTags(tags: { [key: string]: string }): OSMCourseData['address'] {
    return {
      street:
        tags['addr:street'] || tags['addr:housenumber'] + ' ' + tags['addr:street'] || undefined,
      city: tags['addr:city'] || undefined,
      state: tags['addr:state'] || undefined,
      country: tags['addr:country'] || undefined,
      postalCode: tags['addr:postcode'] || undefined,
    };
  }

  /**
   * Extract course amenities from tags
   */
  private extractCourseAmenities(tags: { [key: string]: string }): string[] {
    const amenities: string[] = [];

    if (tags.amenity) amenities.push(tags.amenity);
    if (tags.shop) amenities.push(`${tags.shop} shop`);
    if (tags.club === 'golf') amenities.push('Golf club');
    if (tags.building === 'clubhouse') amenities.push('Clubhouse');

    return amenities;
  }

  /**
   * Extract course features from tags
   */
  private extractCourseFeatures(tags: { [key: string]: string }): string[] {
    const features: string[] = [];

    if (tags.holes) features.push(`${tags.holes} holes`);
    if (tags.par) features.push(`Par ${tags.par}`);
    if (tags.fee === 'yes') features.push('Paid course');
    if (tags.access === 'private') features.push('Private course');
    if (tags.access === 'public') features.push('Public course');

    return features;
  }

  /**
   * Determine POI type from tags
   */
  private determinePoiType(tags: { [key: string]: string }): string {
    if (tags.tourism === 'hotel') return 'hotel';
    if (tags.amenity === 'restaurant') return 'restaurant';
    if (tags.aeroway === 'aerodrome') return 'airport';
    if (tags.tourism === 'attraction') return 'attraction';
    if (tags.amenity) return tags.amenity;
    if (tags.tourism) return tags.tourism;

    return 'unknown';
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(service: 'overpass' | 'nominatim' = 'overpass'): Promise<void> {
    const limit =
      service === 'overpass' ? config.api.overpassRateLimit : config.api.nominatimRateLimit;
    const now = Date.now();
    const minutesPassed = (now - this.lastReset) / 60000;

    if (minutesPassed >= 1) {
      this.requestCount = 0;
      this.lastReset = now;
    }

    if (this.requestCount >= limit) {
      const waitTime = 60000 - (now - this.lastReset);
      if (waitTime > 0) {
        apiLogger.warn(`${service} rate limit reached, waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.lastReset = Date.now();
      }
    }
  }

  /**
   * Increment request counter
   */
  private incrementRequestCount(): void {
    this.requestCount++;
  }

  /**
   * Create standardized API error
   */
  private createAPIError(endpoint: string, error: any): APIError {
    return {
      service: 'osm',
      endpoint,
      statusCode: error.response?.status,
      message: error.message || 'Unknown OSM API error',
      originalError: error,
      timestamp: new Date(),
      retryable: !error.response || error.response.status >= 500,
    };
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    rateLimitStatus: {
      remaining: number;
      resetTime: Date;
      withinLimits: boolean;
    };
  } {
    const remaining = Math.max(0, config.api.overpassRateLimit - this.requestCount);
    const withinLimits = remaining > 2; // Consider healthy if we have more than 2 requests left

    return {
      status: withinLimits ? 'healthy' : 'degraded',
      rateLimitStatus: {
        remaining,
        resetTime: new Date(this.lastReset + 60000),
        withinLimits,
      },
    };
  }
}
