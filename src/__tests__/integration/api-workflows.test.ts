import { APIManager } from '../../services/api/api-manager';
import { dataValidator } from '../../utils/data-validation';
import type { CourseEnrichmentData } from '../../types/api.types';

// Mock external HTTP requests for integration tests
jest.mock('axios');
const mockedAxios = require('axios');

describe('API Workflows Integration Tests', () => {
  let apiManager: APIManager;

  beforeEach(() => {
    apiManager = new APIManager();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await apiManager.cleanup();
  });

  describe('Complete Course Enrichment Workflow', () => {
    it('should enrich a golf course with all available data sources', async () => {
      // Mock OpenWeather API response
      const mockWeatherResponse = {
        coord: { lon: -121.9473, lat: 36.5694 },
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        main: { temp: 72, feels_like: 75, temp_min: 68, temp_max: 76, pressure: 1013, humidity: 55 },
        wind: { speed: 8, deg: 270 },
        visibility: 10000,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: 'Pebble Beach',
      };

      // Mock Wikipedia search response
      const mockWikipediaSearchResponse = {
        query: {
          search: [
            {
              title: 'Pebble Beach Golf Links',
              snippet: 'Famous golf course designed by Jack Neville and Douglas Grant',
              size: 50000,
              wordcount: 5000,
            },
          ],
        },
      };

      // Mock Wikipedia page content
      const mockWikipediaPageContent = `
        <html>
          <body>
            <p>Pebble Beach Golf Links is a renowned golf course located in Pebble Beach, California.
            The course was designed by Jack Neville and Douglas Grant and opened in 1919.</p>
            <div class="infobox">
              <tr><td>Architect</td><td>Jack Neville, Douglas Grant</td></tr>
              <tr><td>Opened</td><td>1919</td></tr>
            </div>
            <p>The course has hosted the U.S. Open multiple times, including in 1972, 1982, 1992, 2000, and 2010.</p>
          </body>
        </html>
      `;

      // Mock OSM Overpass response
      const mockOSMResponse = {
        elements: [
          {
            type: 'way',
            id: 123456,
            tags: {
              name: 'Pebble Beach Golf Links',
              leisure: 'golf_course',
              holes: '18',
              par: '72',
              'addr:city': 'Pebble Beach',
              'addr:state': 'California',
              'addr:country': 'US',
            },
            geometry: [
              { lat: 36.5694, lon: -121.9473 },
              { lat: 36.5704, lon: -121.9483 },
            ],
          },
        ],
      };

      // Setup axios mocks
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockWeatherResponse }) // Current weather
        .mockResolvedValueOnce({ data: { list: [], city: { name: 'Pebble Beach', country: 'US', timezone: 0 } } }) // Forecast
        .mockResolvedValueOnce({ data: mockWikipediaSearchResponse }) // Wikipedia search
        .mockResolvedValueOnce({ data: { parse: { text: { '*': mockWikipediaPageContent } } } }) // Wikipedia content
        .mockResolvedValueOnce({ data: { entities: {} } }); // Wikidata

      mockedAxios.post
        .mockResolvedValueOnce({ data: mockOSMResponse }) // OSM course location
        .mockResolvedValueOnce({ data: { elements: [] } }); // OSM amenities

      // Course to enrich
      const courseToEnrich = {
        id: 'pebble-beach-golf-links',
        name: 'Pebble Beach Golf Links',
        location: 'California',
        city: 'Pebble Beach',
        state: 'CA',
        lat: 36.5694,
        lon: -121.9473,
      };

      // Execute enrichment workflow
      const [weatherResult, historyResult, locationResult] = await Promise.all([
        apiManager.getGolfWeather(courseToEnrich.id, courseToEnrich.lat, courseToEnrich.lon),
        apiManager.getCourseHistory(courseToEnrich.name, courseToEnrich.location),
        apiManager.getCourseLocation(courseToEnrich.name, courseToEnrich.city, courseToEnrich.state),
      ]);

      // Verify all APIs returned data
      expect(weatherResult.success).toBe(true);
      expect(weatherResult.data).toBeDefined();
      expect(weatherResult.data!.golfConditions).toBeDefined();

      expect(historyResult.success).toBe(true);
      expect(historyResult.data).toBeDefined();

      expect(locationResult.success).toBe(true);
      expect(locationResult.data).toBeDefined();

      // Combine enrichment data
      const enrichmentData: CourseEnrichmentData = {
        weather: weatherResult.data!,
        historical: historyResult.data!,
        location: locationResult.data!,
        enrichmentMetadata: {
          sources: ['openweather', 'wikipedia', 'osm'],
          lastUpdated: new Date(),
          confidence: 0,
          dataCompleteness: 0,
          errors: [],
        },
      };

      // Validate and clean the enriched data
      const { result: validationResult, cleanedData } = dataValidator.validateAndClean(
        'enrichment',
        enrichmentData
      );

      expect(validationResult.valid).toBe(true);
      expect(cleanedData.enrichmentMetadata.confidence).toBeGreaterThan(70);
      expect(cleanedData.enrichmentMetadata.dataCompleteness).toBeGreaterThan(50);

      // Verify specific data points
      expect(cleanedData.weather!.current.temperature).toBeDefined();
      expect(cleanedData.weather!.golfConditions.playability).toBeDefined();
      expect(cleanedData.historical!.architect).toContain('Jack Neville');
      expect(cleanedData.historical!.openingYear).toBe(1919);
      expect(cleanedData.location!.coordinates).toEqual([-121.9473, 36.5694]);

    }, 30000); // 30 second timeout for integration test

    it('should handle partial API failures gracefully', async () => {
      // Mock successful weather API
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            coord: { lon: -122.4194, lat: 37.7749 },
            weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
            main: { temp: 70, feels_like: 72, temp_min: 68, temp_max: 74, pressure: 1013, humidity: 60 },
            wind: { speed: 5, deg: 270 },
            visibility: 10000,
            sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
            timezone: -28800,
            name: 'San Francisco',
          },
        }) // Successful weather
        .mockResolvedValueOnce({ data: { list: [], city: { name: 'SF', country: 'US', timezone: 0 } } }) // Forecast
        .mockRejectedValueOnce(new Error('Wikipedia API unavailable')) // Failed Wikipedia
        .mockRejectedValueOnce(new Error('Wikipedia API unavailable'));

      // Mock failed OSM API
      mockedAxios.post.mockRejectedValueOnce(new Error('OSM API unavailable'));

      const courseToEnrich = {
        id: 'test-course',
        name: 'Test Golf Course',
        location: 'California',
        city: 'San Francisco',
        state: 'CA',
        lat: 37.7749,
        lon: -122.4194,
      };

      // Execute enrichment workflow with some failures
      const [weatherResult, historyResult, locationResult] = await Promise.allSettled([
        apiManager.getGolfWeather(courseToEnrich.id, courseToEnrich.lat, courseToEnrich.lon),
        apiManager.getCourseHistory(courseToEnrich.name, courseToEnrich.location),
        apiManager.getCourseLocation(courseToEnrich.name, courseToEnrich.city, courseToEnrich.state),
      ]);

      // Verify weather succeeded
      expect(weatherResult.status).toBe('fulfilled');
      if (weatherResult.status === 'fulfilled') {
        expect(weatherResult.value.success).toBe(true);
      }

      // History and location should fail gracefully
      expect(historyResult.status).toBe('fulfilled');
      if (historyResult.status === 'fulfilled') {
        expect(historyResult.value.success).toBe(false);
      }

      expect(locationResult.status).toBe('fulfilled');
      if (locationResult.status === 'fulfilled') {
        expect(locationResult.value.success).toBe(false);
      }

      // Should still be able to create partial enrichment data
      const partialEnrichmentData: CourseEnrichmentData = {
        weather: weatherResult.status === 'fulfilled' && weatherResult.value.success
          ? weatherResult.value.data
          : undefined,
        enrichmentMetadata: {
          sources: ['openweather'],
          lastUpdated: new Date(),
          confidence: 0,
          dataCompleteness: 0,
          errors: ['Wikipedia API unavailable', 'OSM API unavailable'],
        },
      };

      const { result: validationResult, cleanedData } = dataValidator.validateAndClean(
        'enrichment',
        partialEnrichmentData
      );

      expect(validationResult.valid).toBe(true);
      expect(cleanedData.weather).toBeDefined();
      expect(cleanedData.historical).toBeUndefined();
      expect(cleanedData.location).toBeUndefined();
      expect(cleanedData.enrichmentMetadata.errors).toHaveLength(2);

    }, 20000);
  });

  describe('Batch Course Enrichment Workflow', () => {
    it('should enrich multiple courses with rate limiting', async () => {
      // Mock responses for multiple courses
      const mockWeatherResponses = [
        {
          coord: { lon: -121.9473, lat: 36.5694 },
          weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
          main: { temp: 72, feels_like: 75, temp_min: 68, temp_max: 76, pressure: 1013, humidity: 55 },
          wind: { speed: 8, deg: 270 },
          visibility: 10000,
          sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
          timezone: -28800,
          name: 'Pebble Beach',
        },
        {
          coord: { lon: -82.0204, lat: 33.5020 },
          weather: [{ id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }],
          main: { temp: 78, feels_like: 80, temp_min: 75, temp_max: 82, pressure: 1015, humidity: 65 },
          wind: { speed: 6, deg: 180 },
          visibility: 10000,
          sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
          timezone: -18000,
          name: 'Augusta',
        },
      ];

      const mockForecastResponse = { list: [], city: { name: 'Test', country: 'US', timezone: 0 } };

      // Setup multiple API responses
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockWeatherResponses[0] })
        .mockResolvedValueOnce({ data: mockForecastResponse })
        .mockResolvedValueOnce({ data: mockWeatherResponses[1] })
        .mockResolvedValueOnce({ data: mockForecastResponse });

      const coursesToEnrich = [
        {
          id: 'pebble-beach',
          name: 'Pebble Beach Golf Links',
          location: 'California',
          city: 'Pebble Beach',
          state: 'CA',
          lat: 36.5694,
          lon: -121.9473,
        },
        {
          id: 'augusta-national',
          name: 'Augusta National Golf Club',
          location: 'Georgia',
          city: 'Augusta',
          state: 'GA',
          lat: 33.5020,
          lon: -82.0204,
        },
      ];

      const startTime = Date.now();
      const batchResult = await apiManager.batchEnrichCourses(coursesToEnrich);
      const endTime = Date.now();

      expect(batchResult.successful).toBeGreaterThan(0);
      expect(batchResult.failed).toBeDefined();
      expect(batchResult.processingTime).toBeGreaterThan(0);

      // Should respect rate limiting delays (2 seconds between courses)
      expect(endTime - startTime).toBeGreaterThan(2000);

    }, 30000);
  });

  describe('API Health and Monitoring', () => {
    it('should track API usage statistics', async () => {
      // Mock a simple weather API call
      mockedAxios.get.mockResolvedValue({
        data: {
          coord: { lon: -122.4194, lat: 37.7749 },
          weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
          main: { temp: 70, feels_like: 72, temp_min: 68, temp_max: 74, pressure: 1013, humidity: 60 },
          wind: { speed: 5, deg: 270 },
          visibility: 10000,
          sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
          timezone: -28800,
          name: 'Test Location',
        },
      });

      // Execute API calls
      await apiManager.getCurrentWeather('test-course', 37.7749, -122.4194);

      // Check statistics
      const stats = apiManager.getStats();

      expect(stats.global.totalRequests).toBeGreaterThan(0);
      expect(stats.global.successfulRequests).toBeGreaterThan(0);
      expect(stats.services).toBeDefined();
      expect(stats.health).toBeDefined();

    }, 10000);

    it('should provide health status for all services', () => {
      const healthStatus = apiManager.getHealthStatus();

      expect(healthStatus.overall).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthStatus.overall);
      expect(healthStatus.services).toBeDefined();
      expect(Array.isArray(healthStatus.services)).toBe(true);
      expect(healthStatus.timestamp).toBeInstanceOf(Date);
      expect(typeof healthStatus.uptime).toBe('number');

      // Each service should have health info
      healthStatus.services.forEach(service => {
        expect(service.service).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(service.status);
        expect(service.rateLimitStatus).toBeDefined();
        expect(typeof service.rateLimitStatus.remaining).toBe('number');
        expect(service.rateLimitStatus.resetTime).toBeInstanceOf(Date);
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from transient network errors', async () => {
      let callCount = 0;

      // Mock network failure followed by success
      mockedAxios.get.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Network timeout') as any;
          error.code = 'ETIMEDOUT';
          return Promise.reject(error);
        }
        return Promise.resolve({
          data: {
            coord: { lon: -122.4194, lat: 37.7749 },
            weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
            main: { temp: 70, feels_like: 72, temp_min: 68, temp_max: 74, pressure: 1013, humidity: 60 },
            wind: { speed: 5, deg: 270 },
            visibility: 10000,
            sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
            timezone: -28800,
            name: 'Test Location',
          },
        });
      });

      const result = await apiManager.getCurrentWeather('test-course', 37.7749, -122.4194);

      // Should eventually succeed despite initial failure
      expect(result.success).toBe(true);
      expect(callCount).toBeGreaterThan(1); // Should have retried

    }, 15000);

    it('should handle rate limit exceeded scenarios', async () => {
      // Mock rate limit exceeded error
      const rateLimitError = new Error('API rate limit exceeded') as any;
      rateLimitError.response = { status: 429 };

      mockedAxios.get.mockRejectedValue(rateLimitError);

      const result = await apiManager.getCurrentWeather('test-course', 37.7749, -122.4194);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.retryable).toBe(true); // Rate limits should be retryable

    }, 10000);
  });

  describe('Data Quality and Validation', () => {
    it('should validate and clean enriched data', async () => {
      // Mock API responses with some data quality issues
      const mockWeatherWithIssues = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 800, main: '  Clear  ', description: '  clear sky [1]  ', icon: '01d' }],
        main: { temp: 70.7, feels_like: 72.3, temp_min: 68, temp_max: 74, pressure: 1013, humidity: 60 },
        wind: { speed: 5.8, deg: 270 },
        visibility: 10000,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: '  Test Location  ',
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockWeatherWithIssues })
        .mockResolvedValueOnce({ data: { list: [], city: { name: 'Test', country: 'US', timezone: 0 } } });

      const result = await apiManager.getGolfWeather('test-course', 37.7749, -122.4194);

      expect(result.success).toBe(true);

      // Data should be cleaned automatically
      expect(result.data!.current.temperature).toBe(71); // Rounded
      expect(result.data!.current.conditions).toBe('Clear'); // Trimmed
      expect(result.data!.current.description).toBe('clear sky'); // Cleaned
      expect(result.data!.location.name).toBe('Test Location'); // Trimmed

    }, 10000);
  });

  describe('Performance and Optimization', () => {
    it('should complete enrichment within reasonable time limits', async () => {
      // Mock fast API responses
      mockedAxios.get.mockResolvedValue({
        data: {
          coord: { lon: -122.4194, lat: 37.7749 },
          weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
          main: { temp: 70, feels_like: 72, temp_min: 68, temp_max: 74, pressure: 1013, humidity: 60 },
          wind: { speed: 5, deg: 270 },
          visibility: 10000,
          sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
          timezone: -28800,
          name: 'Test Location',
        },
      });

      const startTime = Date.now();
      const result = await apiManager.getCurrentWeather('test-course', 37.7749, -122.4194);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

    }, 10000);

    it('should benefit from caching on subsequent requests', async () => {
      // First request - cache miss
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            coord: { lon: -122.4194, lat: 37.7749 },
            weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
            main: { temp: 70, feels_like: 72, temp_min: 68, temp_max: 74, pressure: 1013, humidity: 60 },
            wind: { speed: 5, deg: 270 },
            visibility: 10000,
            sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
            timezone: -28800,
            name: 'Test Location',
          },
        })
        .mockResolvedValueOnce({ data: { list: [], city: { name: 'Test', country: 'US', timezone: 0 } } });

      // First request
      const result1 = await apiManager.getGolfWeather('test-course', 37.7749, -122.4194);
      expect(result1.success).toBe(true);
      expect(result1.cached).toBe(false);

      // Second request should be faster (cached)
      const startTime = Date.now();
      const result2 = await apiManager.getGolfWeather('test-course', 37.7749, -122.4194);
      const endTime = Date.now();

      expect(result2.success).toBe(true);
      expect(result2.cached).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast from cache

    }, 10000);
  });
});