import type { AxiosResponse } from 'axios';
import axios from 'axios';
import * as moment from 'moment-timezone';
import type {
  WeatherData,
  WeatherConditions,
  WeatherForecastDay,
  OpenWeatherResponse,
  OpenWeatherForecastResponse,
  APIResponse,
  APIError,
  GolfWeatherData,
  GolfWeatherConditions,
} from '../../types/api.types';
import { apiLogger } from '../../utils/logger';
import config from '../../config/config';

export class WeatherService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';
  private readonly timeout: number;
  private requestCount = 0;
  private lastReset = Date.now();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.api.openWeatherApiKey;
    this.timeout = config.scraping.timeoutMs;

    if (!this.apiKey) {
      apiLogger.warn('OpenWeather API key not provided. Weather service will be disabled.');
    }
  }

  /**
   * Get current weather conditions for a location
   */
  async getCurrentWeather(lat: number, lon: number): Promise<APIResponse<WeatherData>> {
    const requestId = `weather-current-${Date.now()}`;
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        throw new Error('OpenWeather API key not configured');
      }

      await this.checkRateLimit();

      apiLogger.info(`Fetching current weather for coordinates: ${lat}, ${lon}`, {
        requestId,
        service: 'openweather',
      });

      const response: AxiosResponse<OpenWeatherResponse> = await axios.get(
        `${this.baseUrl}/weather`,
        {
          params: {
            lat,
            lon,
            appid: this.apiKey,
            units: 'imperial', // Fahrenheit for US golf courses
            exclude: 'minutely,alerts', // Reduce response size
          },
          timeout: this.timeout,
          headers: {
            'User-Agent': config.scraping.userAgent,
          },
        },
      );

      this.incrementRequestCount();

      const weatherData = this.formatCurrentWeather(response.data);
      const processingTime = Date.now() - startTime;

      apiLogger.info(`Current weather fetched successfully`, {
        requestId,
        processingTime,
        location: weatherData.location.name,
        temperature: weatherData.current.temperature,
      });

      return {
        success: true,
        data: weatherData,
        cached: false,
        requestId,
        processingTime,
        remainingRequests: this.getRemainingRequests(),
        resetTime: new Date(this.lastReset + 60000), // Rate limit resets every minute
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const apiError = this.createAPIError('getCurrentWeather', error);

      apiLogger.error('Failed to fetch current weather', error, {
        requestId,
        processingTime,
        coordinates: `${lat}, ${lon}`,
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
   * Get 5-day weather forecast for a location
   */
  async get5DayForecast(lat: number, lon: number): Promise<APIResponse<WeatherData>> {
    const requestId = `weather-forecast-${Date.now()}`;
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        throw new Error('OpenWeather API key not configured');
      }

      await this.checkRateLimit();

      apiLogger.info(`Fetching 5-day forecast for coordinates: ${lat}, ${lon}`, {
        requestId,
        service: 'openweather',
      });

      const response: AxiosResponse<OpenWeatherForecastResponse> = await axios.get(
        `${this.baseUrl}/forecast`,
        {
          params: {
            lat,
            lon,
            appid: this.apiKey,
            units: 'imperial',
            cnt: 40, // 5 days * 8 (3-hour intervals)
          },
          timeout: this.timeout,
          headers: {
            'User-Agent': config.scraping.userAgent,
          },
        },
      );

      this.incrementRequestCount();

      const weatherData = this.formatForecastWeather(response.data);
      const processingTime = Date.now() - startTime;

      apiLogger.info(`5-day forecast fetched successfully`, {
        requestId,
        processingTime,
        location: weatherData.location.name,
        forecastDays: weatherData.forecast.length,
      });

      return {
        success: true,
        data: weatherData,
        cached: false,
        requestId,
        processingTime,
        remainingRequests: this.getRemainingRequests(),
        resetTime: new Date(this.lastReset + 60000),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const apiError = this.createAPIError('get5DayForecast', error);

      apiLogger.error('Failed to fetch 5-day forecast', error, {
        requestId,
        processingTime,
        coordinates: `${lat}, ${lon}`,
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
   * Get weather data with golf-specific insights
   */
  async getGolfWeather(lat: number, lon: number): Promise<APIResponse<GolfWeatherData>> {
    const requestId = `golf-weather-${Date.now()}`;
    const startTime = Date.now();

    try {
      // Get both current and forecast data
      const [currentResult, forecastResult] = await Promise.all([
        this.getCurrentWeather(lat, lon),
        this.get5DayForecast(lat, lon),
      ]);

      if (!currentResult.success) {
        return {
          success: false,
          error: currentResult.error,
          cached: false,
          requestId,
          processingTime: Date.now() - startTime,
        };
      }

      // Use current weather as base, supplement with forecast if available
      const weatherData = currentResult.data!;

      if (forecastResult.success && forecastResult.data) {
        weatherData.forecast = forecastResult.data.forecast;
      }

      // Add golf-specific analysis
      const golfWeatherData = this.addGolfInsights(weatherData);
      const processingTime = Date.now() - startTime;

      apiLogger.info(`Golf weather data generated successfully`, {
        requestId,
        processingTime,
        playability: golfWeatherData.golfConditions.playability,
        recommendations: golfWeatherData.golfConditions.recommendations.length,
      });

      return {
        success: true,
        data: golfWeatherData,
        cached: false,
        requestId,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const apiError = this.createAPIError('getGolfWeather', error);

      apiLogger.error('Failed to generate golf weather data', error, {
        requestId,
        processingTime,
        coordinates: `${lat}, ${lon}`,
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
   * Format current weather data from OpenWeather API
   */
  private formatCurrentWeather(rawData: OpenWeatherResponse): WeatherData {
    const weather = rawData.weather[0];
    const main = rawData.main;
    const wind = rawData.wind;

    const current: WeatherConditions = {
      temperature: Math.round(main.temp),
      feelsLike: Math.round(main.feels_like),
      humidity: main.humidity,
      windSpeed: Math.round(wind.speed || 0),
      windDirection: wind.deg || 0,
      windGust: wind.gust ? Math.round(wind.gust) : undefined,
      conditions: weather.main,
      description: weather.description,
      visibility: Math.round((rawData.visibility || 10000) / 1609.34), // Convert to miles
      pressure: Math.round(main.pressure * 0.02953), // Convert hPa to inHg
      dewPoint: this.calculateDewPoint(main.temp, main.humidity),
    };

    return {
      current,
      forecast: [], // Will be populated by forecast call
      location: {
        latitude: rawData.coord.lat,
        longitude: rawData.coord.lon,
        name: rawData.name,
        country: rawData.sys.country,
        timezone: this.getTimezoneFromOffset(rawData.timezone),
      },
      lastUpdated: new Date(),
      source: 'openweather',
    };
  }

  /**
   * Format forecast weather data from OpenWeather API
   */
  private formatForecastWeather(rawData: OpenWeatherForecastResponse): WeatherData {
    // Group forecast entries by day and calculate daily summaries
    const dailyForecasts = new Map<string, any[]>();

    rawData.list.forEach((entry) => {
      const date = moment.unix(entry.dt).format('YYYY-MM-DD');
      if (!dailyForecasts.has(date)) {
        dailyForecasts.set(date, []);
      }
      dailyForecasts.get(date)!.push(entry);
    });

    const forecast: WeatherForecastDay[] = Array.from(dailyForecasts.entries())
      .slice(0, 5) // Limit to 5 days
      .map(([date, entries]) => {
        const temperatures = entries.map((e) => e.main.temp);
        const precipitations = entries.map((e) => e.pop);
        const conditions = entries.map((e) => e.weather[0].main);
        const winds = entries.map((e) => e.wind);

        // Find most common condition
        const conditionCounts = conditions.reduce(
          (acc, condition) => {
            acc[condition] = (acc[condition] || 0) + 1;
            return acc;
          },
          {} as { [key: string]: number },
        );

        const mostCommonCondition = Object.entries(conditionCounts).sort(
          ([, a], [, b]) => b - a,
        )[0][0];

        return {
          date,
          tempHigh: Math.round(Math.max(...temperatures)),
          tempLow: Math.round(Math.min(...temperatures)),
          precipitation: Math.round(Math.max(...precipitations.map((p) => p * 100))), // Convert to percentage
          precipitationProbability: Math.round(Math.max(...precipitations) * 100),
          conditions: mostCommonCondition,
          description: entries[Math.floor(entries.length / 2)].weather[0].description,
          windSpeed: Math.round(winds.reduce((sum, w) => sum + (w.speed || 0), 0) / winds.length),
          windDirection: winds[Math.floor(winds.length / 2)].deg || 0,
          humidity: Math.round(
            entries.reduce((sum, e) => sum + e.main.humidity, 0) / entries.length,
          ),
        };
      });

    return {
      current: {} as WeatherConditions, // Will be populated by current weather call
      forecast,
      location: {
        latitude: 0, // Will be set from current weather
        longitude: 0,
        name: rawData.city.name,
        country: rawData.city.country,
        timezone: this.getTimezoneFromOffset(rawData.city.timezone),
      },
      lastUpdated: new Date(),
      source: 'openweather',
    };
  }

  /**
   * Add golf-specific weather insights
   */
  private addGolfInsights(weatherData: WeatherData): GolfWeatherData {
    const current = weatherData.current;
    const golfConditions = this.assessGolfConditions(current);
    const forecastSummary = this.createForecastSummary(weatherData.forecast);

    return {
      ...weatherData,
      golfConditions,
      forecastSummary,
    };
  }

  /**
   * Assess golf playing conditions based on weather
   */
  private assessGolfConditions(weather: WeatherConditions): GolfWeatherConditions {
    const temp = weather.temperature;
    const wind = weather.windSpeed;
    const conditions = weather.conditions.toLowerCase();
    const humidity = weather.humidity;

    // Determine playability
    let playability: GolfWeatherConditions['playability'] = 'excellent';
    let windImpact: GolfWeatherConditions['windImpact'] = 'minimal';
    let temperatureComfort: GolfWeatherConditions['temperatureComfort'] = 'comfortable';
    let precipitationRisk: GolfWeatherConditions['precipitationRisk'] = 'none';

    // Temperature assessment
    if (temp < 40) {
      temperatureComfort = 'cold';
      playability = 'marginal';
    } else if (temp < 55) {
      temperatureComfort = 'cool';
    } else if (temp < 75) {
      temperatureComfort = 'comfortable';
    } else if (temp < 85) {
      temperatureComfort = 'warm';
    } else {
      temperatureComfort = 'hot';
      if (temp > 95) playability = 'marginal';
    }

    // Wind assessment
    if (wind > 25) {
      windImpact = 'severe';
      playability = 'poor';
    } else if (wind > 15) {
      windImpact = 'significant';
      if (playability === 'excellent') playability = 'good';
    } else if (wind > 8) {
      windImpact = 'moderate';
    }

    // Precipitation assessment
    if (conditions.includes('rain') || conditions.includes('storm')) {
      precipitationRisk = conditions.includes('heavy') ? 'heavy' : 'moderate';
      playability = 'unplayable';
    } else if (conditions.includes('drizzle') || conditions.includes('light')) {
      precipitationRisk = 'light';
      playability = 'poor';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const alerts: string[] = [];

    if (temperatureComfort === 'cold') {
      recommendations.push('Wear warm layers and consider hand warmers');
    } else if (temperatureComfort === 'hot') {
      recommendations.push('Stay hydrated and wear sun protection');
      recommendations.push('Consider early morning or late afternoon tee times');
    }

    if (windImpact === 'significant' || windImpact === 'severe') {
      recommendations.push('Expect challenging wind conditions - club up');
      if (windImpact === 'severe') {
        alerts.push('Strong winds may affect play quality');
      }
    }

    if (humidity > 80) {
      recommendations.push('High humidity - extra hydration recommended');
    }

    if (precipitationRisk !== 'none') {
      recommendations.push('Pack rain gear');
      if (precipitationRisk === 'heavy') {
        alerts.push('Heavy rain likely - consider rescheduling');
      }
    }

    return {
      playability,
      windImpact,
      temperatureComfort,
      precipitationRisk,
      recommendations,
      alerts,
    };
  }

  /**
   * Create forecast summary for golf planning
   */
  private createForecastSummary(forecast: WeatherForecastDay[]): {
    bestDays: string[];
    worstDays: string[];
    weekendOutlook: string;
  } {
    const scoredDays = forecast.map((day) => {
      let score = 100;

      // Temperature scoring
      const avgTemp = (day.tempHigh + day.tempLow) / 2;
      if (avgTemp < 50 || avgTemp > 90) score -= 30;
      else if (avgTemp < 60 || avgTemp > 80) score -= 15;

      // Precipitation scoring
      score -= day.precipitationProbability;

      // Wind scoring (assuming wind data might not always be available)
      if (day.windSpeed > 20) score -= 25;
      else if (day.windSpeed > 15) score -= 15;

      return { ...day, score };
    });

    const sortedDays = [...scoredDays].sort((a, b) => b.score - a.score);
    const bestDays = sortedDays.slice(0, 2).map((d) => d.date);
    const worstDays = sortedDays.slice(-2).map((d) => d.date);

    // Weekend outlook (Saturday and Sunday)
    const weekend = forecast.filter((day) => {
      const dayOfWeek = moment(day.date).day();
      return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    });

    let weekendOutlook = 'No weekend data available';
    if (weekend.length > 0) {
      const avgWeekendScore =
        weekend.reduce((sum, day) => {
          const scored = scoredDays.find((s) => s.date === day.date);
          return sum + (scored?.score || 50);
        }, 0) / weekend.length;

      if (avgWeekendScore >= 80) {
        weekendOutlook = 'Excellent weekend conditions for golf';
      } else if (avgWeekendScore >= 65) {
        weekendOutlook = 'Good weekend conditions expected';
      } else if (avgWeekendScore >= 50) {
        weekendOutlook = 'Fair weekend conditions - some challenges expected';
      } else {
        weekendOutlook = 'Challenging weekend conditions - consider alternatives';
      }
    }

    return {
      bestDays,
      worstDays,
      weekendOutlook,
    };
  }

  /**
   * Rate limiting check (60 requests per minute for free tier)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const minutesPassed = (now - this.lastReset) / 60000;

    if (minutesPassed >= 1) {
      // Reset counter every minute
      this.requestCount = 0;
      this.lastReset = now;
    }

    if (this.requestCount >= config.api.openWeatherRateLimit) {
      const waitTime = 60000 - (now - this.lastReset);
      if (waitTime > 0) {
        apiLogger.warn(`OpenWeather rate limit reached, waiting ${waitTime}ms`);
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
   * Get remaining requests in current minute
   */
  private getRemainingRequests(): number {
    return Math.max(0, config.api.openWeatherRateLimit - this.requestCount);
  }

  /**
   * Create standardized API error
   */
  private createAPIError(endpoint: string, error: any): APIError {
    return {
      service: 'openweather',
      endpoint,
      statusCode: error.response?.status,
      message: error.message || 'Unknown API error',
      originalError: error,
      timestamp: new Date(),
      retryable: !error.response || error.response.status >= 500,
    };
  }

  /**
   * Calculate dew point from temperature and humidity
   */
  private calculateDewPoint(tempF: number, humidity: number): number {
    const tempC = ((tempF - 32) * 5) / 9;
    const a = 17.27;
    const b = 237.7;
    const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
    const dewPointC = (b * alpha) / (a - alpha);
    return Math.round((dewPointC * 9) / 5 + 32); // Convert back to Fahrenheit
  }

  /**
   * Convert timezone offset to timezone string
   */
  private getTimezoneFromOffset(offsetSeconds: number): string {
    const offsetHours = offsetSeconds / 3600;
    const sign = offsetHours >= 0 ? '+' : '-';
    const absHours = Math.abs(offsetHours);
    const hours = Math.floor(absHours);
    const minutes = (absHours - hours) * 60;
    return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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
    const remaining = this.getRemainingRequests();
    const withinLimits = remaining > 5; // Consider healthy if we have more than 5 requests left

    return {
      status: !this.apiKey ? 'unhealthy' : withinLimits ? 'healthy' : 'degraded',
      rateLimitStatus: {
        remaining,
        resetTime: new Date(this.lastReset + 60000),
        withinLimits,
      },
    };
  }
}
