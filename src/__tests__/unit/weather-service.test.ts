import { WeatherService } from '../../services/weather/weather-service';
import axios from 'axios';
import type { OpenWeatherResponse, OpenWeatherForecastResponse } from '../../types/api.types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WeatherService', () => {
  let weatherService: WeatherService;

  beforeEach(() => {
    weatherService = new WeatherService('test-api-key');
    jest.clearAllMocks();
  });

  describe('getCurrentWeather', () => {
    it('should fetch and process current weather data successfully', async () => {
      const mockResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{
          id: 800,
          main: 'Clear',
          description: 'clear sky',
          icon: '01d',
        }],
        main: {
          temp: 72,
          feels_like: 75,
          temp_min: 68,
          temp_max: 76,
          pressure: 1013,
          humidity: 60,
        },
        wind: {
          speed: 8,
          deg: 270,
          gust: 12,
        },
        visibility: 10000,
        sys: {
          country: 'US',
          sunrise: 1640000000,
          sunset: 1640040000,
        },
        timezone: -28800,
        name: 'San Francisco',
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.current.temperature).toBe(72);
      expect(result.data!.current.conditions).toBe('Clear');
      expect(result.data!.location.name).toBe('San Francisco');
      expect(result.data!.location.latitude).toBe(37.7749);
      expect(result.data!.location.longitude).toBe(-122.4194);
      expect(result.cached).toBe(false);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.service).toBe('openweather');
      expect(result.error!.message).toBe('API Error');
      expect(result.error!.retryable).toBe(true);
    });

    it('should handle missing API key', async () => {
      const serviceWithoutKey = new WeatherService();

      const result = await serviceWithoutKey.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('API key not configured');
    });

    it('should respect rate limits', async () => {
      // Mock multiple rapid calls
      mockedAxios.get.mockResolvedValue({ data: {} });

      const promises = [];
      for (let i = 0; i < 65; i++) { // Exceed the 60/minute limit
        promises.push(weatherService.getCurrentWeather(37.7749, -122.4194));
      }

      const results = await Promise.all(promises);

      // Should handle rate limiting
      expect(results.length).toBe(65);
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('should calculate dew point correctly', async () => {
      const mockResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        main: { temp: 80, feels_like: 82, temp_min: 75, temp_max: 85, pressure: 1013, humidity: 70 },
        wind: { speed: 5, deg: 180 },
        visibility: 10000,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: 'Test Location',
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data!.current.dewPoint).toBeDefined();
      expect(typeof result.data!.current.dewPoint).toBe('number');
      expect(result.data!.current.dewPoint).toBeGreaterThan(0);
      expect(result.data!.current.dewPoint).toBeLessThan(result.data!.current.temperature);
    });
  });

  describe('get5DayForecast', () => {
    it('should fetch and process forecast data successfully', async () => {
      const mockResponse: OpenWeatherForecastResponse = {
        list: [
          {
            dt: 1640000000,
            main: { temp: 70, temp_min: 65, temp_max: 75, pressure: 1013, humidity: 60 },
            weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
            wind: { speed: 8, deg: 270 },
            pop: 0.1,
            dt_txt: '2021-12-20 12:00:00',
          },
          {
            dt: 1640010800,
            main: { temp: 68, temp_min: 63, temp_max: 73, pressure: 1015, humidity: 65 },
            weather: [{ main: 'Clouds', description: 'few clouds', icon: '02d' }],
            wind: { speed: 6, deg: 250 },
            pop: 0.2,
            dt_txt: '2021-12-20 15:00:00',
          },
        ],
        city: {
          name: 'Test City',
          country: 'US',
          timezone: -28800,
        },
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await weatherService.get5DayForecast(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.forecast).toBeDefined();
      expect(result.data!.location.name).toBe('Test City');
    });
  });

  describe('getGolfWeather', () => {
    it('should combine current and forecast data with golf insights', async () => {
      const mockCurrentResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        main: { temp: 75, feels_like: 78, temp_min: 70, temp_max: 80, pressure: 1013, humidity: 45 },
        wind: { speed: 12, deg: 270, gust: 18 },
        visibility: 10000,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: 'Golf Course Location',
      };

      const mockForecastResponse: OpenWeatherForecastResponse = {
        list: [
          {
            dt: 1640000000,
            main: { temp: 72, temp_min: 68, temp_max: 76, pressure: 1013, humidity: 50 },
            weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
            wind: { speed: 10, deg: 270 },
            pop: 0.0,
            dt_txt: '2021-12-20 12:00:00',
          },
        ],
        city: { name: 'Golf Course Location', country: 'US', timezone: -28800 },
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockCurrentResponse })
        .mockResolvedValueOnce({ data: mockForecastResponse });

      const result = await weatherService.getGolfWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.golfConditions).toBeDefined();
      expect(result.data!.golfConditions.playability).toBeDefined();
      expect(result.data!.golfConditions.windImpact).toBeDefined();
      expect(result.data!.golfConditions.temperatureComfort).toBeDefined();
      expect(result.data!.golfConditions.recommendations).toBeDefined();
      expect(Array.isArray(result.data!.golfConditions.recommendations)).toBe(true);
      expect(result.data!.forecastSummary).toBeDefined();
    });

    it('should assess golf conditions correctly for good weather', async () => {
      const mockResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        main: { temp: 72, feels_like: 74, temp_min: 68, temp_max: 76, pressure: 1013, humidity: 50 },
        wind: { speed: 6, deg: 270 }, // Moderate wind
        visibility: 10000,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: 'Perfect Golf Weather',
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockResponse })
        .mockResolvedValueOnce({ data: { list: [], city: { name: 'Test', country: 'US', timezone: 0 } } });

      const result = await weatherService.getGolfWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data!.golfConditions.playability).toBe('excellent');
      expect(result.data!.golfConditions.temperatureComfort).toBe('comfortable');
      expect(result.data!.golfConditions.windImpact).toBe('minimal');
      expect(result.data!.golfConditions.precipitationRisk).toBe('none');
    });

    it('should assess golf conditions correctly for poor weather', async () => {
      const mockResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 502, main: 'Rain', description: 'heavy intensity rain', icon: '10d' }],
        main: { temp: 45, feels_like: 40, temp_min: 42, temp_max: 48, pressure: 1000, humidity: 90 },
        wind: { speed: 28, deg: 270, gust: 35 }, // Strong wind
        visibility: 3000,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: 'Bad Golf Weather',
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockResponse })
        .mockResolvedValueOnce({ data: { list: [], city: { name: 'Test', country: 'US', timezone: 0 } } });

      const result = await weatherService.getGolfWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data!.golfConditions.playability).toBe('unplayable');
      expect(result.data!.golfConditions.temperatureComfort).toBe('cold');
      expect(result.data!.golfConditions.windImpact).toBe('severe');
      expect(result.data!.golfConditions.precipitationRisk).toBe('heavy');
      expect(result.data!.golfConditions.alerts.length).toBeGreaterThan(0);
    });

    it('should provide appropriate golf recommendations', async () => {
      const mockResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        main: { temp: 95, feels_like: 98, temp_min: 90, temp_max: 100, pressure: 1013, humidity: 85 },
        wind: { speed: 18, deg: 270 },
        visibility: 10000,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: 'Hot Golf Weather',
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockResponse })
        .mockResolvedValueOnce({ data: { list: [], city: { name: 'Test', country: 'US', timezone: 0 } } });

      const result = await weatherService.getGolfWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data!.golfConditions.recommendations).toContain('Stay hydrated and wear sun protection');
      expect(result.data!.golfConditions.recommendations).toContain('Consider early morning or late afternoon tee times');
      expect(result.data!.golfConditions.recommendations).toContain('High humidity - extra hydration recommended');
      expect(result.data!.golfConditions.recommendations).toContain('Expect challenging wind conditions - club up');
    });
  });

  describe('health status', () => {
    it('should return healthy status with valid API key', () => {
      const health = weatherService.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.rateLimitStatus).toBeDefined();
      expect(health.rateLimitStatus.remaining).toBeGreaterThan(0);
      expect(health.rateLimitStatus.withinLimits).toBe(true);
    });

    it('should return unhealthy status without API key', () => {
      const serviceWithoutKey = new WeatherService();
      const health = serviceWithoutKey.getHealthStatus();

      expect(health.status).toBe('unhealthy');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle HTTP errors with status codes', async () => {
      const error = new Error('Unauthorized') as any;
      error.response = { status: 401 };

      mockedAxios.get.mockRejectedValue(error);

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(false);
      expect(result.error!.statusCode).toBe(401);
      expect(result.error!.retryable).toBe(false); // 401 is not retryable
    });

    it('should handle network timeouts', async () => {
      const error = new Error('timeout of 30000ms exceeded') as any;
      error.code = 'ETIMEDOUT';

      mockedAxios.get.mockRejectedValue(error);

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(false);
      expect(result.error!.retryable).toBe(true); // Network errors are retryable
    });

    it('should handle malformed API responses', async () => {
      const malformedResponse = {
        // Missing required fields
        coord: { lon: -122.4194 }, // Missing lat
        weather: [], // Empty array
        main: null,
      };

      mockedAxios.get.mockResolvedValue({ data: malformedResponse });

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      // Should handle gracefully, may succeed with partial data or fail cleanly
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should calculate timezone offset correctly', async () => {
      const mockResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        main: { temp: 72, feels_like: 74, temp_min: 68, temp_max: 76, pressure: 1013, humidity: 50 },
        wind: { speed: 6, deg: 270 },
        visibility: 10000,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800, // PST (UTC-8)
        name: 'San Francisco',
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data!.location.timezone).toBe('UTC-08:00');
    });

    it('should handle extreme weather values gracefully', async () => {
      const mockResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        main: { temp: -40, feels_like: -45, temp_min: -50, temp_max: -35, pressure: 900, humidity: 100 },
        wind: { speed: 150, deg: 270, gust: 200 }, // Extreme wind
        visibility: 0,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: 'Extreme Weather',
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      // Should handle extreme values without crashing
      expect(result.data!.current.temperature).toBe(-40);
      expect(result.data!.current.windSpeed).toBe(150);
    });
  });

  describe('data processing and formatting', () => {
    it('should round numeric values appropriately', async () => {
      const mockResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        main: { temp: 72.7, feels_like: 74.3, temp_min: 68.9, temp_max: 76.1, pressure: 1013.25, humidity: 60.5 },
        wind: { speed: 8.7, deg: 270.5 },
        visibility: 10000,
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: 'Test Location',
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      expect(result.data!.current.temperature).toBe(73); // Rounded
      expect(result.data!.current.feelsLike).toBe(74); // Rounded
      expect(result.data!.current.windSpeed).toBe(9); // Rounded
      expect(Number.isInteger(result.data!.current.temperature)).toBe(true);
      expect(Number.isInteger(result.data!.current.windSpeed)).toBe(true);
    });

    it('should convert units correctly', async () => {
      const mockResponse: OpenWeatherResponse = {
        coord: { lon: -122.4194, lat: 37.7749 },
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        main: { temp: 72, feels_like: 74, temp_min: 68, temp_max: 76, pressure: 1013, humidity: 60 },
        wind: { speed: 8, deg: 270 },
        visibility: 10000, // meters
        sys: { country: 'US', sunrise: 1640000000, sunset: 1640040000 },
        timezone: -28800,
        name: 'Test Location',
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await weatherService.getCurrentWeather(37.7749, -122.4194);

      expect(result.success).toBe(true);
      // Visibility should be converted from meters to miles
      expect(result.data!.current.visibility).toBe(6); // ~10000m = ~6 miles
      // Pressure should be converted from hPa to inHg
      expect(result.data!.current.pressure).toBe(30); // ~1013 hPa = ~30 inHg
    });
  });
});