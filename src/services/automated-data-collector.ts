import { performance } from 'perf_hooks';
import { DynamicScraper } from './scrapers/dynamic-scraper';
import { StaticScraper } from './scrapers/static-scraper';
import { WeatherService } from './weather/weather-service';
import { WikipediaService } from './wikipedia/wikipedia-service';
import { OSMService } from './osm/osm-service';
import { apiLogger } from '../utils/logger';

import type {
  CourseTarget,
  CollectedData,
  WebsiteData,
  WikipediaData,
  LocationData,
  HistoricalData,
  ImageData,
  ContactInfo,
  PricingInfo,
  NearbyAmenity,
  ChampionshipEvent,
  RenovationEvent,
} from '../types/automation.types';

import type { WeatherData } from '../types/api.types';

/**
 * Collection configuration options
 */
export interface CollectionConfig {
  enableWeather: boolean;
  enableHistory: boolean;
  enableImages: boolean;
  enableLocation: boolean;
  timeout: number;
  retryAttempts: number;
  sources: {
    website: boolean;
    wikipedia: boolean;
    weather: boolean;
    osm: boolean;
  };
}

/**
 * Automated Data Collector
 *
 * Orchestrates data collection from multiple sources including:
 * - Official course websites
 * - Wikipedia/Wikidata
 * - Weather APIs
 * - OpenStreetMap/Overpass
 * - Image sources
 */
export class AutomatedDataCollector {
  private readonly logger = apiLogger.child({ service: 'data-collector' });
  private readonly dynamicScraper: DynamicScraper;
  private readonly staticScraper: StaticScraper;
  private readonly weatherService: WeatherService;
  private readonly wikipediaService: WikipediaService;
  private readonly osmService: OSMService;

  constructor() {
    this.dynamicScraper = new DynamicScraper();
    this.staticScraper = new StaticScraper();
    this.weatherService = new WeatherService();
    this.wikipediaService = new WikipediaService();
    this.osmService = new OSMService();

    this.logger.info('Automated Data Collector initialized');
  }

  /**
   * Collect comprehensive data for a single course
   */
  async collectCourseData(
    course: CourseTarget,
    config: Partial<CollectionConfig> = {}
  ): Promise<CollectedData> {
    const fullConfig: CollectionConfig = {
      enableWeather: true,
      enableHistory: true,
      enableImages: true,
      enableLocation: true,
      timeout: 30000,
      retryAttempts: 2,
      sources: {
        website: true,
        wikipedia: true,
        weather: true,
        osm: true,
      },
      ...config,
    };

    const courseLogger = this.logger.child({
      courseId: course.id,
      courseName: course.name,
    });

    courseLogger.info('Starting comprehensive data collection');

    const collectionTasks: Promise<any>[] = [];
    const taskNames: string[] = [];

    // Official website data
    if (fullConfig.sources.website) {
      collectionTasks.push(this.collectFromOfficialWebsite(course, fullConfig));
      taskNames.push('website');
    }

    // Wikipedia data
    if (fullConfig.sources.wikipedia) {
      collectionTasks.push(this.collectFromWikipedia(course, fullConfig));
      taskNames.push('wikipedia');
    }

    // Weather data
    if (fullConfig.sources.weather && fullConfig.enableWeather && course.latitude && course.longitude) {
      collectionTasks.push(this.collectWeatherData(course, fullConfig));
      taskNames.push('weather');
    }

    // Location and OSM data
    if (fullConfig.sources.osm && fullConfig.enableLocation) {
      collectionTasks.push(this.collectLocationData(course, fullConfig));
      taskNames.push('location');
    }

    // Historical data (from Wikipedia)
    if (fullConfig.enableHistory) {
      collectionTasks.push(this.collectHistoricalData(course, fullConfig));
      taskNames.push('history');
    }

    // Execute all collection tasks in parallel
    courseLogger.info(`Executing ${collectionTasks.length} collection tasks in parallel`);
    const results = await Promise.allSettled(collectionTasks);

    // Merge and process results
    const mergedData = await this.mergeCollectionResults(results, taskNames, course, courseLogger);

    courseLogger.info('Data collection completed', {
      sources: mergedData.sources.length,
      confidence: mergedData.confidence,
      hasWebsiteData: !!mergedData.websiteData,
      hasWikipediaData: !!mergedData.wikipediaData,
      hasWeatherData: !!mergedData.weatherData,
      hasLocationData: !!mergedData.locationData,
      hasHistoricalData: !!mergedData.historicalData,
      imageCount: mergedData.imageData?.length || 0,
    });

    return mergedData;
  }

  /**
   * Collect data from the course's official website
   */
  private async collectFromOfficialWebsite(
    course: CourseTarget,
    config: CollectionConfig
  ): Promise<WebsiteData | null> {
    const logger = this.logger.child({ task: 'website-collection', courseId: course.id });

    try {
      logger.info('Starting website data collection');

      // Find official website if not provided
      let website = course.website;
      if (!website) {
        website = await this.findOfficialWebsite(course);
        if (!website) {
          throw new Error('No official website found');
        }
      }

      logger.info(`Scraping website: ${website}`);

      // Try dynamic scraping first (for JavaScript-heavy sites)
      let scrapingResult;
      try {
        scrapingResult = await this.dynamicScraper.scrapeWebsite({
          url: website,
          extractors: [
            'title',
            'description',
            'contact',
            'amenities',
            'pricing',
            'images',
            'policies',
          ],
          timeout: config.timeout,
        });
      } catch (dynamicError) {
        logger.warn('Dynamic scraping failed, trying static scraping', { error: dynamicError.message });

        // Fallback to static scraping
        scrapingResult = await this.staticScraper.scrapeWebsite({
          url: website,
          extractors: [
            'title',
            'description',
            'contact',
            'amenities',
            'pricing',
            'images',
            'policies',
          ],
        });
      }

      // Process and structure the scraped data
      const websiteData: WebsiteData = {
        url: website,
        title: scrapingResult.title || course.name,
        description: scrapingResult.description,
        contact: this.extractContactInfo(scrapingResult),
        amenities: scrapingResult.amenities || [],
        pricing: this.extractPricingInfo(scrapingResult),
        images: scrapingResult.images || [],
        policies: scrapingResult.policies || [],
        lastScraped: new Date(),
        scrapingSuccess: true,
      };

      logger.info('Website data collection successful', {
        hasDescription: !!websiteData.description,
        contactInfo: !!websiteData.contact,
        amenitiesCount: websiteData.amenities?.length || 0,
        imagesCount: websiteData.images?.length || 0,
      });

      return websiteData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Website scraping failed: ${errorMessage}`);

      return {
        url: course.website || '',
        lastScraped: new Date(),
        scrapingSuccess: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Collect data from Wikipedia
   */
  private async collectFromWikipedia(
    course: CourseTarget,
    config: CollectionConfig
  ): Promise<WikipediaData | null> {
    const logger = this.logger.child({ task: 'wikipedia-collection', courseId: course.id });

    try {
      logger.info('Starting Wikipedia data collection');

      // Search for the course on Wikipedia
      const searchResult = await this.wikipediaService.searchCourse(course.name, course.location);

      if (!searchResult) {
        logger.info('No Wikipedia article found');
        return null;
      }

      logger.info(`Found Wikipedia article: ${searchResult.title}`);

      // Extract detailed course data
      const articleData = await this.wikipediaService.extractCourseData(searchResult.title);

      const wikipediaData: WikipediaData = {
        title: searchResult.title,
        extract: articleData.extract,
        architects: articleData.architects,
        yearOpened: articleData.yearOpened,
        championships: articleData.championships,
        images: articleData.images,
        infobox: articleData.infobox,
        lastUpdated: new Date(),
        confidence: searchResult.confidence,
      };

      logger.info('Wikipedia data collection successful', {
        hasExtract: !!wikipediaData.extract,
        architectsCount: wikipediaData.architects?.length || 0,
        championshipsCount: wikipediaData.championships?.length || 0,
        imagesCount: wikipediaData.images?.length || 0,
        yearOpened: wikipediaData.yearOpened,
      });

      return wikipediaData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Wikipedia collection failed: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Collect weather data
   */
  private async collectWeatherData(
    course: CourseTarget,
    config: CollectionConfig
  ): Promise<WeatherData | null> {
    const logger = this.logger.child({ task: 'weather-collection', courseId: course.id });

    try {
      if (!course.latitude || !course.longitude) {
        throw new Error('Latitude and longitude required for weather data');
      }

      logger.info('Starting weather data collection', {
        latitude: course.latitude,
        longitude: course.longitude,
      });

      const weatherData = await this.weatherService.getCurrentWeather(
        course.latitude,
        course.longitude
      );

      logger.info('Weather data collection successful', {
        temperature: weatherData.current.temperature,
        conditions: weatherData.current.conditions,
        forecastDays: weatherData.forecast.length,
      });

      return weatherData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Weather collection failed: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Collect location and nearby amenities data
   */
  private async collectLocationData(
    course: CourseTarget,
    config: CollectionConfig
  ): Promise<LocationData | null> {
    const logger = this.logger.child({ task: 'location-collection', courseId: course.id });

    try {
      logger.info('Starting location data collection');

      // Get detailed location data from OSM
      let locationData: LocationData;

      if (course.latitude && course.longitude) {
        // Use coordinates for reverse geocoding
        const osmData = await this.osmService.reverseGeocode(course.latitude, course.longitude);
        locationData = this.convertOSMToLocationData(osmData, course);
      } else {
        // Search by name and location
        const searchQuery = `${course.name} ${course.location}`;
        const osmData = await this.osmService.searchLocation(searchQuery);
        locationData = this.convertOSMToLocationData(osmData, course);
      }

      // Get nearby amenities
      if (locationData.latitude && locationData.longitude) {
        locationData.nearbyAmenities = await this.getNearbyAmenities(
          locationData.latitude,
          locationData.longitude
        );
      }

      logger.info('Location data collection successful', {
        address: locationData.address,
        city: locationData.city,
        state: locationData.state,
        amenitiesCount: locationData.nearbyAmenities?.length || 0,
      });

      return locationData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Location collection failed: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Collect historical data about the course
   */
  private async collectHistoricalData(
    course: CourseTarget,
    config: CollectionConfig
  ): Promise<HistoricalData | null> {
    const logger = this.logger.child({ task: 'history-collection', courseId: course.id });

    try {
      logger.info('Starting historical data collection');

      // Extract historical information from Wikipedia
      const historyData = await this.wikipediaService.extractCourseHistory(course.name);

      if (!historyData) {
        logger.info('No historical data found');
        return null;
      }

      const historicalData: HistoricalData = {
        events: historyData.events?.map(this.convertToChampionshipEvent),
        renovations: historyData.renovations?.map(this.convertToRenovationEvent),
        architects: historyData.architects,
        yearOpened: historyData.yearOpened,
        yearClosed: historyData.yearClosed,
        notableFeatures: historyData.notableFeatures,
      };

      logger.info('Historical data collection successful', {
        eventsCount: historicalData.events?.length || 0,
        renovationsCount: historicalData.renovations?.length || 0,
        architectsCount: historicalData.architects?.length || 0,
        yearOpened: historicalData.yearOpened,
      });

      return historicalData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Historical data collection failed: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Find official website using search techniques
   */
  private async findOfficialWebsite(course: CourseTarget): Promise<string | null> {
    // Implementation would include:
    // 1. Google search for official website
    // 2. Social media profile extraction
    // 3. Golf directory lookups
    // 4. Domain verification

    this.logger.info(`Searching for official website for ${course.name}`);

    // Placeholder implementation
    // In real implementation, this would use search APIs or web scraping
    return null;
  }

  /**
   * Extract contact information from scraped data
   */
  private extractContactInfo(scrapingResult: any): ContactInfo | undefined {
    if (!scrapingResult.contact) return undefined;

    return {
      phone: scrapingResult.contact.phone,
      email: scrapingResult.contact.email,
      website: scrapingResult.contact.website,
      address: scrapingResult.contact.address,
    };
  }

  /**
   * Extract pricing information from scraped data
   */
  private extractPricingInfo(scrapingResult: any): PricingInfo | undefined {
    if (!scrapingResult.pricing) return undefined;

    return {
      greenFees: scrapingResult.pricing.greenFees,
      cartRental: scrapingResult.pricing.cartRental,
      membershipTypes: scrapingResult.pricing.membershipTypes,
      seasonalRates: scrapingResult.pricing.seasonalRates,
    };
  }

  /**
   * Convert OSM data to LocationData format
   */
  private convertOSMToLocationData(osmData: any, course: CourseTarget): LocationData {
    return {
      latitude: osmData.lat || course.latitude || 0,
      longitude: osmData.lon || course.longitude || 0,
      address: osmData.display_name || '',
      city: osmData.address?.city || osmData.address?.town || '',
      state: osmData.address?.state || '',
      country: osmData.address?.country || '',
      postalCode: osmData.address?.postcode,
      osmData: osmData,
    };
  }

  /**
   * Get nearby amenities from OSM
   */
  private async getNearbyAmenities(
    latitude: number,
    longitude: number
  ): Promise<NearbyAmenity[]> {
    try {
      const amenities = await this.osmService.getNearbyAmenities(latitude, longitude, 5000); // 5km radius

      return amenities.map(amenity => ({
        name: amenity.name || 'Unnamed',
        type: amenity.amenity || amenity.tourism || 'other',
        distance: this.calculateDistance(latitude, longitude, amenity.lat, amenity.lon),
        rating: undefined, // Would be enhanced from other sources
      }));

    } catch (error) {
      this.logger.warn('Failed to get nearby amenities', { error: error.message });
      return [];
    }
  }

  /**
   * Calculate distance between two points in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Convert to ChampionshipEvent format
   */
  private convertToChampionshipEvent(event: any): ChampionshipEvent {
    return {
      name: event.name,
      year: event.year,
      winner: event.winner,
      type: event.type || 'other',
    };
  }

  /**
   * Convert to RenovationEvent format
   */
  private convertToRenovationEvent(renovation: any): RenovationEvent {
    return {
      year: renovation.year,
      architect: renovation.architect,
      description: renovation.description,
      scope: renovation.scope || 'minor',
    };
  }

  /**
   * Merge results from all collection tasks
   */
  private async mergeCollectionResults(
    results: PromiseSettledResult<any>[],
    taskNames: string[],
    course: CourseTarget,
    logger: any
  ): Promise<CollectedData> {
    const mergedData: CollectedData = {
      id: course.id,
      name: course.name,
      sources: [],
      confidence: 0,
      collectedAt: new Date(),
    };

    const successfulSources: string[] = [];
    let totalConfidence = 0;

    results.forEach((result, index) => {
      const taskName = taskNames[index];

      if (result.status === 'fulfilled' && result.value) {
        successfulSources.push(taskName);

        // Assign data based on task type
        switch (taskName) {
          case 'website':
            mergedData.websiteData = result.value;
            totalConfidence += result.value.scrapingSuccess ? 0.3 : 0.1;
            break;
          case 'wikipedia':
            mergedData.wikipediaData = result.value;
            totalConfidence += result.value.confidence || 0.25;
            break;
          case 'weather':
            mergedData.weatherData = result.value;
            totalConfidence += 0.2;
            break;
          case 'location':
            mergedData.locationData = result.value;
            totalConfidence += 0.15;
            break;
          case 'history':
            mergedData.historicalData = result.value;
            totalConfidence += 0.1;
            break;
        }

        logger.info(`Task ${taskName} completed successfully`);
      } else {
        logger.warn(`Task ${taskName} failed:`, {
          error: result.status === 'rejected' ? result.reason.message : 'Unknown error'
        });
      }
    });

    // Collect image data from all sources
    const imageData: ImageData[] = [];

    if (mergedData.websiteData?.images) {
      imageData.push(...mergedData.websiteData.images.map(url => ({
        url,
        category: 'gallery' as const,
        source: 'website',
        downloadStatus: 'pending' as const,
      })));
    }

    if (mergedData.wikipediaData?.images) {
      imageData.push(...mergedData.wikipediaData.images.map(url => ({
        url,
        category: 'gallery' as const,
        source: 'wikipedia',
        downloadStatus: 'pending' as const,
      })));
    }

    mergedData.imageData = imageData;
    mergedData.sources = successfulSources;
    mergedData.confidence = Math.min(totalConfidence, 1.0); // Cap at 1.0

    logger.info('Data merging completed', {
      sources: successfulSources.length,
      confidence: mergedData.confidence,
      imageCount: imageData.length,
    });

    return mergedData;
  }
}

export { AutomatedDataCollector };