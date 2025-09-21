import { APIManager } from '../../services/api/api-manager';
import { WeatherService } from '../../services/weather/weather-service';
import { WikipediaService } from '../../services/wikipedia/wikipedia-service';
import { OSMService } from '../../services/osm/osm-service';

// Mock all service dependencies
jest.mock('../../services/weather/weather-service');
jest.mock('../../services/weather/weather-cache');
jest.mock('../../services/wikipedia/wikipedia-service');
jest.mock('../../services/wikipedia/course-history-extractor');
jest.mock('../../services/osm/osm-service');

const MockedWeatherService = WeatherService as jest.MockedClass<typeof WeatherService>;
const MockedWikipediaService = WikipediaService as jest.MockedClass<typeof WikipediaService>;
const MockedOSMService = OSMService as jest.MockedClass<typeof OSMService>;

describe('APIManager', () => {
  let apiManager: APIManager;
  let mockWeatherService: jest.Mocked<WeatherService>;
  let mockWikipediaService: jest.Mocked<WikipediaService>;
  let mockOSMService: jest.Mocked<OSMService>;

  beforeEach(() => {
    // Setup mocks
    mockWeatherService = {
      getCurrentWeather: jest.fn(),
      get5DayForecast: jest.fn(),
      getGolfWeather: jest.fn(),
      getHealthStatus: jest.fn().mockReturnValue({
        status: 'healthy',
        rateLimitStatus: { remaining: 50, resetTime: new Date(), withinLimits: true },
      }),
    } as any;

    mockWikipediaService = {
      searchCourseArticle: jest.fn(),
      extractCourseData: jest.fn(),
      getHealthStatus: jest.fn().mockReturnValue({
        status: 'healthy',
        rateLimitStatus: { remaining: 180, resetTime: new Date(), withinLimits: true },
      }),
    } as any;

    mockOSMService = {
      findCourseLocation: jest.fn(),
      getNearbyAmenities: jest.fn(),
      getCourseDetails: jest.fn(),
      getHealthStatus: jest.fn().mockReturnValue({
        status: 'healthy',
        rateLimitStatus: { remaining: 8, resetTime: new Date(), withinLimits: true },
      }),
    } as any;

    MockedWeatherService.mockImplementation(() => mockWeatherService);
    MockedWikipediaService.mockImplementation(() => mockWikipediaService);
    MockedOSMService.mockImplementation(() => mockOSMService);

    apiManager = new APIManager();
  });

  afterEach(async () => {
    await apiManager.cleanup();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize all services correctly', () => {
      expect(MockedWeatherService).toHaveBeenCalled();
      expect(MockedWikipediaService).toHaveBeenCalled();
      expect(MockedOSMService).toHaveBeenCalled();
    });

    it('should setup health checking', () => {
      const health = apiManager.getHealthStatus();
      expect(health).toBeDefined();
      expect(health.overall).toBeDefined();
      expect(health.services).toBeDefined();
      expect(Array.isArray(health.services)).toBe(true);
    });
  });

  describe('makeAPICall', () => {
    it('should execute API call successfully', async () => {
      const mockRequestFn = jest.fn().mockResolvedValue('test-result');

      const result = await apiManager.makeAPICall('weather', mockRequestFn);

      expect(result.success).toBe(true);
      expect(result.data).toBe('test-result');
      expect(result.requestId).toBeDefined();
      expect(result.processingTime).toBeDefined();
      expect(mockRequestFn).toHaveBeenCalled();
    });

    it('should handle API call failures', async () => {
      const mockRequestFn = jest.fn().mockRejectedValue(new Error('API failure'));

      const result = await apiManager.makeAPICall('weather', mockRequestFn);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.service).toBe('weather');
      expect(result.error!.message).toBe('API failure');
    });

    it('should handle unregistered services', async () => {
      const mockRequestFn = jest.fn();

      const result = await apiManager.makeAPICall('nonexistent', mockRequestFn);

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Service nonexistent not registered');
      expect(mockRequestFn).not.toHaveBeenCalled();
    });

    it('should track statistics', async () => {
      const mockRequestFn = jest.fn().mockResolvedValue('success');

      await apiManager.makeAPICall('weather', mockRequestFn);
      await apiManager.makeAPICall('weather', jest.fn().mockRejectedValue(new Error('fail')));

      const stats = apiManager.getStats();

      expect(stats.global.totalRequests).toBe(2);
      expect(stats.global.successfulRequests).toBe(1);
      expect(stats.global.failedRequests).toBe(1);
    });

    it('should respect rate limits', async () => {
      const fastRequestFn = jest.fn().mockResolvedValue('fast');

      // Make many rapid requests
      const promises = [];
      for (let i = 0; i < 35; i++) { // Exceed weather service limit (30/min)
        promises.push(apiManager.makeAPICall('weather', fastRequestFn));
      }

      const results = await Promise.all(promises);

      // All should complete, but some may be delayed due to rate limiting
      expect(results.length).toBe(35);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should skip rate limiting when requested', async () => {
      const mockRequestFn = jest.fn().mockResolvedValue('no-limit');

      const result = await apiManager.makeAPICall('weather', mockRequestFn, {
        skipRateLimit: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('no-limit');
    });

    it('should handle circuit breaker trips', async () => {
      // Cause multiple failures to trip circuit breaker
      const failingFn = jest.fn().mockRejectedValue(new Error('Circuit breaker test'));

      const promises = [];
      for (let i = 0; i < 6; i++) { // Exceed circuit breaker threshold
        promises.push(apiManager.makeAPICall('weather', failingFn));
      }

      const results = await Promise.all(promises);

      // Later requests should be blocked by circuit breaker
      expect(results.length).toBe(6);
      const stats = apiManager.getStats();
      expect(stats.global.failedRequests).toBeGreaterThan(0);
    });
  });

  describe('weather methods', () => {
    beforeEach(() => {
      // Mock weather cache methods
      const mockWeatherCache = {
        getCurrentWeather: jest.fn(),
        getGolfWeather: jest.fn(),
      };

      // Replace the weather cache instance
      (apiManager as any).weatherCache = mockWeatherCache;
    });

    it('should get current weather through cache', async () => {
      const mockWeatherData = {
        current: { temperature: 75, conditions: 'Clear' },
        location: { name: 'Test Course' },
        forecast: [],
        lastUpdated: new Date(),
        source: 'openweather',
      };

      (apiManager as any).weatherCache.getCurrentWeather.mockResolvedValue({
        success: true,
        data: mockWeatherData,
        cached: true,
        requestId: 'test-123',
        processingTime: 0,
      });

      const result = await apiManager.getCurrentWeather('course-123', 37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockWeatherData);
      expect(result.cached).toBe(true);
    });

    it('should get golf weather through cache', async () => {
      const mockGolfWeatherData = {
        current: { temperature: 75, conditions: 'Clear' },
        location: { name: 'Test Course' },
        forecast: [],
        lastUpdated: new Date(),
        source: 'openweather',
        golfConditions: {
          playability: 'excellent',
          windImpact: 'minimal',
          temperatureComfort: 'comfortable',
          precipitationRisk: 'none',
          recommendations: ['Perfect conditions for golf'],
          alerts: [],
        },
        forecastSummary: {
          bestDays: ['2023-12-20'],
          worstDays: [],
          weekendOutlook: 'Excellent weekend conditions',
        },
      };

      (apiManager as any).weatherCache.getGolfWeather.mockResolvedValue({
        success: true,
        data: mockGolfWeatherData,
        cached: false,
        requestId: 'golf-123',
        processingTime: 1500,
      });

      const result = await apiManager.getGolfWeather('course-123', 37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data!.golfConditions).toBeDefined();
      expect(result.data!.golfConditions.playability).toBe('excellent');
    });
  });

  describe('Wikipedia methods', () => {
    it('should get course history', async () => {
      const mockHistoricalData = {
        architect: 'Tom Fazio',
        coArchitects: [],
        openingYear: 1995,
        renovationYears: [2010],
        renovationArchitects: [],
        majorChampionships: [],
        designPhilosophy: 'Championship design',
        notableFeatures: ['Water hazards'],
        records: [],
        courseChanges: [],
      };

      // Mock the history extractor
      const mockHistoryExtractor = {
        extractHistoricalData: jest.fn().mockResolvedValue({
          success: true,
          data: mockHistoricalData,
          cached: false,
          requestId: 'history-123',
          processingTime: 2000,
        }),
      };

      (apiManager as any).historyExtractor = mockHistoryExtractor;

      const result = await apiManager.getCourseHistory('Pebble Beach', 'California');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHistoricalData);
    });
  });

  describe('OSM methods', () => {
    it('should get course location', async () => {
      const mockLocationData = {
        coordinates: [-122.4194, 37.7749] as [number, number],
        address: {
          street: '123 Golf Course Road',
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
          postalCode: '94102',
        },
        amenities: ['parking', 'restaurant'],
        features: ['18 holes'],
        nearbyFeatures: {
          hotels: [],
          restaurants: [],
          airports: [],
          attractions: [],
        },
        accessibility: {
          wheelchair: true,
          parking: true,
          publicTransport: [],
        },
        lastUpdated: new Date(),
      };

      mockOSMService.findCourseLocation.mockResolvedValue({
        success: true,
        data: mockLocationData,
        cached: false,
        requestId: 'osm-123',
        processingTime: 3000,
      });

      const result = await apiManager.getCourseLocation('Test Golf Course', 'San Francisco', 'CA');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLocationData);
      expect(mockOSMService.findCourseLocation).toHaveBeenCalledWith(
        'Test Golf Course',
        'San Francisco',
        'CA'
      );
    });

    it('should get nearby amenities', async () => {
      const mockAmenities = [
        {
          id: 'hotel-1',
          name: 'Golf Resort Hotel',
          type: 'hotel',
          coordinates: [-122.4200, 37.7750] as [number, number],
          distance: 500,
          tags: { tourism: 'hotel' },
        },
        {
          id: 'restaurant-1',
          name: 'Clubhouse Restaurant',
          type: 'restaurant',
          coordinates: [-122.4190, 37.7748] as [number, number],
          distance: 200,
          tags: { amenity: 'restaurant' },
        },
      ];

      mockOSMService.getNearbyAmenities.mockResolvedValue({
        success: true,
        data: mockAmenities,
        cached: false,
        requestId: 'amenities-123',
        processingTime: 2500,
      });

      const result = await apiManager.getNearbyAmenities(37.7749, -122.4194, 5);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAmenities);
      expect(mockOSMService.getNearbyAmenities).toHaveBeenCalledWith(37.7749, -122.4194, 5);
    });
  });

  describe('batch enrichment', () => {
    it('should process multiple courses successfully', async () => {
      const courses = [
        {
          id: 'course-1',
          name: 'Pebble Beach',
          location: 'California',
          city: 'Pebble Beach',
          state: 'CA',
          lat: 36.5694,
          lon: -121.9473,
        },
        {
          id: 'course-2',
          name: 'Augusta National',
          location: 'Georgia',
          city: 'Augusta',
          state: 'GA',
          lat: 33.5020,
          lon: -82.0204,
        },
      ];

      // Mock successful responses
      (apiManager as any).weatherCache = {
        getGolfWeather: jest.fn().mockResolvedValue({ success: true, data: {} }),
      };

      (apiManager as any).historyExtractor = {
        extractHistoricalData: jest.fn().mockResolvedValue({ success: true, data: {} }),
      };

      const result = await apiManager.batchEnrichCourses(courses);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle mixed success and failure', async () => {
      const courses = [
        {
          id: 'course-1',
          name: 'Working Course',
          location: 'California',
          city: 'Test City',
          state: 'CA',
          lat: 36.5694,
          lon: -121.9473,
        },
        {
          id: 'course-2',
          name: 'Failing Course',
          location: 'Georgia',
          city: 'Test City',
          state: 'GA',
          lat: 33.5020,
          lon: -82.0204,
        },
      ];

      // Mock mixed responses
      (apiManager as any).weatherCache = {
        getGolfWeather: jest.fn()
          .mockResolvedValueOnce({ success: true, data: {} })
          .mockRejectedValueOnce(new Error('Weather API failed')),
      };

      (apiManager as any).historyExtractor = {
        extractHistoricalData: jest.fn()
          .mockResolvedValueOnce({ success: true, data: {} })
          .mockResolvedValueOnce({ success: false, error: { message: 'No data found' } }),
      };

      const result = await apiManager.batchEnrichCourses(courses);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should respect delays between courses', async () => {
      const courses = [
        { id: 'course-1', name: 'Course 1', location: 'CA', city: 'City1', state: 'CA', lat: 36, lon: -121 },
        { id: 'course-2', name: 'Course 2', location: 'GA', city: 'City2', state: 'GA', lat: 33, lon: -82 },
      ];

      (apiManager as any).weatherCache = {
        getGolfWeather: jest.fn().mockResolvedValue({ success: true, data: {} }),
      };

      (apiManager as any).historyExtractor = {
        extractHistoricalData: jest.fn().mockResolvedValue({ success: true, data: {} }),
      };

      const startTime = Date.now();
      await apiManager.batchEnrichCourses(courses);
      const endTime = Date.now();

      // Should take at least 2 seconds due to delays (2 courses * 2s delay between)
      expect(endTime - startTime).toBeGreaterThan(2000);
    });
  });

  describe('health status and statistics', () => {
    it('should provide comprehensive health status', () => {
      const health = apiManager.getHealthStatus();

      expect(health.overall).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.overall);
      expect(health.services).toBeDefined();
      expect(Array.isArray(health.services)).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(typeof health.uptime).toBe('number');
    });

    it('should track service statistics', () => {
      const stats = apiManager.getStats();

      expect(stats.global).toBeDefined();
      expect(stats.services).toBeDefined();
      expect(stats.health).toBeDefined();

      expect(typeof stats.global.totalRequests).toBe('number');
      expect(typeof stats.global.successfulRequests).toBe('number');
      expect(typeof stats.global.failedRequests).toBe('number');
      expect(stats.global.startTime).toBeInstanceOf(Date);
    });

    it('should reset statistics', async () => {
      // Make some API calls first
      await apiManager.makeAPICall('weather', jest.fn().mockResolvedValue('test'));

      let stats = apiManager.getStats();
      expect(stats.global.totalRequests).toBeGreaterThan(0);

      // Reset statistics
      apiManager.resetStats();

      stats = apiManager.getStats();
      expect(stats.global.totalRequests).toBe(0);
      expect(stats.global.successfulRequests).toBe(0);
      expect(stats.global.failedRequests).toBe(0);
    });
  });

  describe('error handling and retries', () => {
    it('should classify retryable errors correctly', async () => {
      const networkError = new Error('Network error') as any;
      networkError.code = 'ECONNRESET';

      const result = await apiManager.makeAPICall('weather', () => Promise.reject(networkError));

      expect(result.success).toBe(false);
      expect(result.error!.retryable).toBe(true);
    });

    it('should classify non-retryable errors correctly', async () => {
      const authError = new Error('Unauthorized') as any;
      authError.response = { status: 401 };

      const result = await apiManager.makeAPICall('weather', () => Promise.reject(authError));

      expect(result.success).toBe(false);
      expect(result.error!.retryable).toBe(false);
    });

    it('should handle rate limit errors as retryable', async () => {
      const rateLimitError = new Error('Rate limit exceeded');

      const result = await apiManager.makeAPICall('weather', () => Promise.reject(rateLimitError));

      expect(result.success).toBe(false);
      expect(result.error!.retryable).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      const cleanupSpy = jest.spyOn(apiManager, 'cleanup');

      await apiManager.cleanup();

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock a cleanup error
      (apiManager as any).weatherCache = {
        clearCache: jest.fn().mockImplementation(() => {
          throw new Error('Cleanup failed');
        }),
      };

      // Should not throw
      await expect(apiManager.cleanup()).resolves.not.toThrow();
    });
  });
});