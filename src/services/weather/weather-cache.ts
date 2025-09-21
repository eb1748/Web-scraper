import NodeCache from 'node-cache';
import type {
  WeatherData,
  GolfWeatherData,
  APIResponse,
  CacheEntry,
  CacheStats,
  CacheConfig,
} from '../../types/api.types';
import { WeatherService } from './weather-service';
import { apiLogger } from '../../utils/logger';

interface WeatherCacheKey {
  type: 'current' | 'forecast' | 'golf';
  lat: number;
  lon: number;
  courseId?: string;
}

interface CachedWeatherData<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
  hits: number;
  requestId: string;
  source: string;
}

export class WeatherCache {
  private currentWeatherCache: NodeCache;
  private forecastCache: NodeCache;
  private golfCache: NodeCache;
  private weatherService: WeatherService;

  // Cache TTL settings (in seconds)
  private readonly CURRENT_TTL = 30 * 60; // 30 minutes
  private readonly FORECAST_TTL = 4 * 60 * 60; // 4 hours
  private readonly GOLF_TTL = 30 * 60; // 30 minutes

  // Cache statistics
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    apiCallsSaved: 0,
    lastReset: new Date(),
  };

  constructor(weatherService: WeatherService, config?: Partial<CacheConfig>) {
    this.weatherService = weatherService;

    // Initialize caches with different TTL values
    this.currentWeatherCache = new NodeCache({
      stdTTL: this.CURRENT_TTL,
      checkperiod: 60, // Check for expired keys every minute
      useClones: false, // Improve performance by not cloning objects
      deleteOnExpire: true,
      maxKeys: config?.maxSize || 1000,
    });

    this.forecastCache = new NodeCache({
      stdTTL: this.FORECAST_TTL,
      checkperiod: 300, // Check every 5 minutes
      useClones: false,
      deleteOnExpire: true,
      maxKeys: config?.maxSize || 500,
    });

    this.golfCache = new NodeCache({
      stdTTL: this.GOLF_TTL,
      checkperiod: 60,
      useClones: false,
      deleteOnExpire: true,
      maxKeys: config?.maxSize || 1000,
    });

    // Set up event listeners for cache monitoring
    this.setupCacheEventListeners();

    apiLogger.info('WeatherCache initialized', {
      currentTTL: this.CURRENT_TTL,
      forecastTTL: this.FORECAST_TTL,
      golfTTL: this.GOLF_TTL,
      maxKeys: config?.maxSize || 1000,
    });
  }

  /**
   * Get current weather with caching
   */
  async getCurrentWeather(
    courseId: string,
    lat: number,
    lon: number
  ): Promise<APIResponse<WeatherData>> {
    const cacheKey = this.generateCacheKey({ type: 'current', lat, lon, courseId });
    this.stats.totalRequests++;

    try {
      // Check cache first
      const cached = this.currentWeatherCache.get<CachedWeatherData<WeatherData>>(cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        this.stats.apiCallsSaved++;
        cached.hits++;

        apiLogger.debug('Weather cache hit for current weather', {
          courseId,
          cacheKey,
          age: Date.now() - cached.timestamp.getTime(),
          hits: cached.hits,
        });

        return {
          success: true,
          data: cached.data,
          cached: true,
          requestId: cached.requestId,
          processingTime: 0, // Instant from cache
        };
      }

      // Cache miss - fetch from API
      this.stats.cacheMisses++;
      const result = await this.weatherService.getCurrentWeather(lat, lon);

      if (result.success && result.data) {
        // Store in cache
        const cachedData: CachedWeatherData<WeatherData> = {
          data: result.data,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + this.CURRENT_TTL * 1000),
          hits: 1,
          requestId: result.requestId,
          source: 'api',
        };

        this.currentWeatherCache.set(cacheKey, cachedData);

        apiLogger.debug('Current weather cached', {
          courseId,
          cacheKey,
          ttl: this.CURRENT_TTL,
          location: result.data.location.name,
        });
      }

      return result;

    } catch (error) {
      apiLogger.error('Error in getCurrentWeather cache operation', error, {
        courseId,
        cacheKey,
      });

      // Return error but don't cache it
      return {
        success: false,
        error: {
          service: 'weather-cache',
          endpoint: 'getCurrentWeather',
          message: error.message,
          originalError: error,
          timestamp: new Date(),
          retryable: true,
        },
        cached: false,
        requestId: `cache-error-${Date.now()}`,
        processingTime: 0,
      };
    }
  }

  /**
   * Get 5-day forecast with caching
   */
  async get5DayForecast(
    courseId: string,
    lat: number,
    lon: number
  ): Promise<APIResponse<WeatherData>> {
    const cacheKey = this.generateCacheKey({ type: 'forecast', lat, lon, courseId });
    this.stats.totalRequests++;

    try {
      // Check cache first
      const cached = this.forecastCache.get<CachedWeatherData<WeatherData>>(cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        this.stats.apiCallsSaved++;
        cached.hits++;

        apiLogger.debug('Weather cache hit for forecast', {
          courseId,
          cacheKey,
          age: Date.now() - cached.timestamp.getTime(),
          hits: cached.hits,
        });

        return {
          success: true,
          data: cached.data,
          cached: true,
          requestId: cached.requestId,
          processingTime: 0,
        };
      }

      // Cache miss - fetch from API
      this.stats.cacheMisses++;
      const result = await this.weatherService.get5DayForecast(lat, lon);

      if (result.success && result.data) {
        // Store in cache
        const cachedData: CachedWeatherData<WeatherData> = {
          data: result.data,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + this.FORECAST_TTL * 1000),
          hits: 1,
          requestId: result.requestId,
          source: 'api',
        };

        this.forecastCache.set(cacheKey, cachedData);

        apiLogger.debug('Forecast weather cached', {
          courseId,
          cacheKey,
          ttl: this.FORECAST_TTL,
          forecastDays: result.data.forecast.length,
        });
      }

      return result;

    } catch (error) {
      apiLogger.error('Error in get5DayForecast cache operation', error, {
        courseId,
        cacheKey,
      });

      return {
        success: false,
        error: {
          service: 'weather-cache',
          endpoint: 'get5DayForecast',
          message: error.message,
          originalError: error,
          timestamp: new Date(),
          retryable: true,
        },
        cached: false,
        requestId: `cache-error-${Date.now()}`,
        processingTime: 0,
      };
    }
  }

  /**
   * Get golf weather with caching
   */
  async getGolfWeather(
    courseId: string,
    lat: number,
    lon: number
  ): Promise<APIResponse<GolfWeatherData>> {
    const cacheKey = this.generateCacheKey({ type: 'golf', lat, lon, courseId });
    this.stats.totalRequests++;

    try {
      // Check cache first
      const cached = this.golfCache.get<CachedWeatherData<GolfWeatherData>>(cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        this.stats.apiCallsSaved++;
        cached.hits++;

        apiLogger.debug('Weather cache hit for golf weather', {
          courseId,
          cacheKey,
          age: Date.now() - cached.timestamp.getTime(),
          hits: cached.hits,
          playability: cached.data.golfConditions.playability,
        });

        return {
          success: true,
          data: cached.data,
          cached: true,
          requestId: cached.requestId,
          processingTime: 0,
        };
      }

      // Cache miss - fetch from API
      this.stats.cacheMisses++;
      const result = await this.weatherService.getGolfWeather(lat, lon);

      if (result.success && result.data) {
        // Store in cache
        const cachedData: CachedWeatherData<GolfWeatherData> = {
          data: result.data,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + this.GOLF_TTL * 1000),
          hits: 1,
          requestId: result.requestId,
          source: 'api',
        };

        this.golfCache.set(cacheKey, cachedData);

        apiLogger.debug('Golf weather cached', {
          courseId,
          cacheKey,
          ttl: this.GOLF_TTL,
          playability: result.data.golfConditions.playability,
          recommendations: result.data.golfConditions.recommendations.length,
        });
      }

      return result;

    } catch (error) {
      apiLogger.error('Error in getGolfWeather cache operation', error, {
        courseId,
        cacheKey,
      });

      return {
        success: false,
        error: {
          service: 'weather-cache',
          endpoint: 'getGolfWeather',
          message: error.message,
          originalError: error,
          timestamp: new Date(),
          retryable: true,
        },
        cached: false,
        requestId: `cache-error-${Date.now()}`,
        processingTime: 0,
      };
    }
  }

  /**
   * Preload weather data for multiple courses
   */
  async preloadWeatherData(courses: Array<{ id: string; lat: number; lon: number }>): Promise<{
    successful: number;
    failed: number;
    cached: number;
    errors: string[];
  }> {
    const results = {
      successful: 0,
      failed: 0,
      cached: 0,
      errors: [] as string[],
    };

    apiLogger.info(`Starting weather data preload for ${courses.length} courses`);

    for (const course of courses) {
      try {
        // Preload both current weather and golf weather (which includes forecast)
        const [currentResult, golfResult] = await Promise.all([
          this.getCurrentWeather(course.id, course.lat, course.lon),
          this.getGolfWeather(course.id, course.lat, course.lon),
        ]);

        if (currentResult.success && golfResult.success) {
          if (currentResult.cached || golfResult.cached) {
            results.cached++;
          } else {
            results.successful++;
          }
        } else {
          results.failed++;
          const errors = [
            ...(currentResult.error ? [currentResult.error.message] : []),
            ...(golfResult.error ? [golfResult.error.message] : []),
          ];
          results.errors.push(...errors);
        }

        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1100)); // Just over 1 second

      } catch (error) {
        results.failed++;
        results.errors.push(`${course.id}: ${error.message}`);
      }
    }

    apiLogger.info('Weather data preload completed', results);
    return results;
  }

  /**
   * Generate cache key from parameters
   */
  private generateCacheKey(params: WeatherCacheKey): string {
    const { type, lat, lon, courseId } = params;
    // Round coordinates to 3 decimal places for reasonable geographic grouping
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLon = Math.round(lon * 1000) / 1000;

    if (courseId) {
      return `${type}-${courseId}-${roundedLat}-${roundedLon}`;
    }
    return `${type}-${roundedLat}-${roundedLon}`;
  }

  /**
   * Clear cache for specific course or location
   */
  clearCache(courseId?: string, lat?: number, lon?: number): number {
    let clearedCount = 0;

    if (courseId || (lat !== undefined && lon !== undefined)) {
      // Clear specific entries
      const keyPattern = courseId ? courseId : `${lat}-${lon}`;

      [this.currentWeatherCache, this.forecastCache, this.golfCache].forEach(cache => {
        const keys = cache.keys().filter(key => key.includes(keyPattern));
        keys.forEach(key => {
          if (cache.del(key)) clearedCount++;
        });
      });
    } else {
      // Clear all caches
      clearedCount += this.currentWeatherCache.keys().length;
      clearedCount += this.forecastCache.keys().length;
      clearedCount += this.golfCache.keys().length;

      this.currentWeatherCache.flushAll();
      this.forecastCache.flushAll();
      this.golfCache.flushAll();
    }

    apiLogger.info(`Cleared ${clearedCount} weather cache entries`, {
      courseId,
      coordinates: lat !== undefined && lon !== undefined ? `${lat}, ${lon}` : undefined,
    });

    return clearedCount;
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): CacheStats {
    const currentStats = this.currentWeatherCache.getStats();
    const forecastStats = this.forecastCache.getStats();
    const golfStats = this.golfCache.getStats();

    const totalEntries = currentStats.keys + forecastStats.keys + golfStats.keys;
    const totalHits = this.stats.cacheHits;
    const totalMisses = this.stats.cacheMisses;
    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

    // Calculate memory usage (approximate)
    const memoryUsage = (currentStats.ksize || 0) + (forecastStats.ksize || 0) + (golfStats.ksize || 0);

    return {
      totalEntries,
      hitRate: Math.round(hitRate * 100) / 100,
      totalHits,
      totalMisses,
      memoryUsage,
      oldestEntry: this.getOldestEntry(),
      newestEntry: this.getNewestEntry(),
    };
  }

  /**
   * Get detailed cache statistics by type
   */
  getDetailedStats(): {
    overall: CacheStats;
    current: any;
    forecast: any;
    golf: any;
    apiCallsSaved: number;
    efficiency: number;
  } {
    const overall = this.getCacheStats();
    const efficiency = this.stats.totalRequests > 0
      ? Math.round((this.stats.apiCallsSaved / this.stats.totalRequests) * 100) / 100
      : 0;

    return {
      overall,
      current: this.currentWeatherCache.getStats(),
      forecast: this.forecastCache.getStats(),
      golf: this.golfCache.getStats(),
      apiCallsSaved: this.stats.apiCallsSaved,
      efficiency,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiCallsSaved: 0,
      lastReset: new Date(),
    };

    apiLogger.info('Weather cache statistics reset');
  }

  /**
   * Setup cache event listeners for monitoring
   */
  private setupCacheEventListeners(): void {
    const caches = [
      { name: 'current', cache: this.currentWeatherCache },
      { name: 'forecast', cache: this.forecastCache },
      { name: 'golf', cache: this.golfCache },
    ];

    caches.forEach(({ name, cache }) => {
      cache.on('expired', (key, value) => {
        apiLogger.debug(`Weather cache entry expired: ${name}`, { key });
      });

      cache.on('del', (key, value) => {
        apiLogger.debug(`Weather cache entry deleted: ${name}`, { key });
      });

      cache.on('set', (key, value) => {
        apiLogger.debug(`Weather cache entry set: ${name}`, { key });
      });
    });
  }

  /**
   * Get oldest cache entry timestamp
   */
  private getOldestEntry(): Date | undefined {
    const allEntries: Date[] = [];

    [this.currentWeatherCache, this.forecastCache, this.golfCache].forEach(cache => {
      cache.keys().forEach(key => {
        const entry = cache.get<CachedWeatherData<any>>(key);
        if (entry) {
          allEntries.push(entry.timestamp);
        }
      });
    });

    return allEntries.length > 0
      ? new Date(Math.min(...allEntries.map(d => d.getTime())))
      : undefined;
  }

  /**
   * Get newest cache entry timestamp
   */
  private getNewestEntry(): Date | undefined {
    const allEntries: Date[] = [];

    [this.currentWeatherCache, this.forecastCache, this.golfCache].forEach(cache => {
      cache.keys().forEach(key => {
        const entry = cache.get<CachedWeatherData<any>>(key);
        if (entry) {
          allEntries.push(entry.timestamp);
        }
      });
    });

    return allEntries.length > 0
      ? new Date(Math.max(...allEntries.map(d => d.getTime())))
      : undefined;
  }

  /**
   * Health check for cache system
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      cacheUtilization: number;
      hitRate: number;
      memoryPressure: boolean;
      recentErrors: number;
    };
  } {
    const stats = this.getCacheStats();
    const detailedStats = this.getDetailedStats();

    const maxEntries = 2500; // Total across all caches
    const cacheUtilization = stats.totalEntries / maxEntries;
    const memoryPressure = cacheUtilization > 0.8; // Above 80% utilization

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (memoryPressure || stats.hitRate < 0.3) {
      status = 'degraded';
    }

    if (stats.hitRate < 0.1 || cacheUtilization > 0.95) {
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        cacheUtilization: Math.round(cacheUtilization * 100) / 100,
        hitRate: stats.hitRate,
        memoryPressure,
        recentErrors: 0, // Could be enhanced to track recent errors
      },
    };
  }
}