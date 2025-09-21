import type {
  RateLimiter,
  APIServiceConfig,
  APIResponse,
  APIError,
  ServiceHealth,
  HealthCheckResult,
  WeatherData,
  GolfWeatherData,
  WikipediaData,
  CourseHistoricalData,
  OSMCourseData,
  POI,
} from '../../types/api.types';
import { WeatherService } from '../weather/weather-service';
import { WeatherCache } from '../weather/weather-cache';
import { WikipediaService } from '../wikipedia/wikipedia-service';
import { CourseHistoryExtractor } from '../wikipedia/course-history-extractor';
import { OSMService } from '../osm/osm-service';
import { CircuitBreaker } from '../../utils/errors';
import { apiLogger } from '../../utils/logger';
import config from '../../config/config';

interface ServiceInstance {
  service: any;
  config: APIServiceConfig;
  rateLimiter: RateLimiter;
  circuitBreaker: CircuitBreaker;
  lastHealthCheck: Date;
  healthStatus: ServiceHealth;
}

interface APICallOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  skipRateLimit?: boolean;
  skipCircuitBreaker?: boolean;
}

export class APIManager {
  private services: Map<string, ServiceInstance> = new Map();
  private globalStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitHits: 0,
    circuitBreakerTrips: 0,
    startTime: new Date(),
  };

  private weatherService: WeatherService;
  private weatherCache: WeatherCache;
  private wikipediaService: WikipediaService;
  private historyExtractor: CourseHistoryExtractor;
  private osmService: OSMService;

  constructor() {
    this.initializeServices();
    this.setupHealthChecking();

    apiLogger.info('APIManager initialized', {
      services: Array.from(this.services.keys()),
      startTime: this.globalStats.startTime,
    });
  }

  /**
   * Initialize all API services
   */
  private initializeServices(): void {
    // Initialize service instances
    this.weatherService = new WeatherService();
    this.weatherCache = new WeatherCache(this.weatherService);
    this.wikipediaService = new WikipediaService();
    this.historyExtractor = new CourseHistoryExtractor(this.wikipediaService);
    this.osmService = new OSMService();

    // Register services with configurations
    this.registerService('weather', this.weatherService, {
      name: 'OpenWeather API',
      baseUrl: 'https://api.openweathermap.org',
      apiKey: config.api.openWeatherApiKey,
      rateLimit: {
        requestsPerMinute: config.api.openWeatherRateLimit,
        requestsPerHour: 1000,
        burstAllowance: 5,
      },
      timeout: config.scraping.timeoutMs,
      retryAttempts: 3,
      retryDelay: 1000,
    });

    this.registerService('wikipedia', this.wikipediaService, {
      name: 'Wikipedia API',
      baseUrl: 'https://en.wikipedia.org',
      rateLimit: {
        requestsPerMinute: config.api.wikipediaRateLimit,
        burstAllowance: 10,
      },
      timeout: config.scraping.timeoutMs,
      retryAttempts: 2,
      retryDelay: 500,
    });

    this.registerService('osm', this.osmService, {
      name: 'OpenStreetMap/Overpass API',
      baseUrl: 'https://overpass-api.de',
      rateLimit: {
        requestsPerMinute: config.api.overpassRateLimit,
        burstAllowance: 2,
      },
      timeout: config.scraping.timeoutMs * 2, // OSM queries can be slow
      retryAttempts: 2,
      retryDelay: 2000,
    });
  }

  /**
   * Register a service with the manager
   */
  private registerService(name: string, service: any, config: APIServiceConfig): void {
    const rateLimiter = this.createRateLimiter(config.rateLimit);
    const circuitBreaker = new CircuitBreaker(5, 300000); // 5 failures, 5 min timeout

    const serviceInstance: ServiceInstance = {
      service,
      config,
      rateLimiter,
      circuitBreaker,
      lastHealthCheck: new Date(),
      healthStatus: {
        service: name,
        status: 'healthy',
        responseTime: 0,
        lastCheck: new Date(),
        errorRate: 0,
        rateLimitStatus: {
          remaining: config.rateLimit.requestsPerMinute,
          resetTime: new Date(Date.now() + 60000),
          withinLimits: true,
        },
      },
    };

    this.services.set(name, serviceInstance);
  }

  /**
   * Create rate limiter for service
   */
  private createRateLimiter(rateConfig: APIServiceConfig['rateLimit']): RateLimiter {
    return {
      requests: 0,
      windowMs: 60000, // 1 minute window
      maxRequests: rateConfig.requestsPerMinute,
      burstAllowance: rateConfig.burstAllowance || 5,
      lastReset: new Date(),

      async acquire(): Promise<void> {
        const now = Date.now();

        // Reset if window has passed
        if (now - this.lastReset.getTime() >= this.windowMs) {
          this.requests = 0;
          this.lastReset = new Date();
        }

        // Check if we can make request
        if (this.requests >= this.maxRequests) {
          const waitTime = this.windowMs - (now - this.lastReset.getTime());
          if (waitTime > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            this.requests = 0;
            this.lastReset = new Date();
          }
        }

        this.requests++;
      },

      canMakeRequest(): boolean {
        const now = Date.now();

        if (now - this.lastReset.getTime() >= this.windowMs) {
          return true;
        }

        return this.requests < this.maxRequests;
      },

      getRemainingRequests(): number {
        const now = Date.now();

        if (now - this.lastReset.getTime() >= this.windowMs) {
          return this.maxRequests;
        }

        return Math.max(0, this.maxRequests - this.requests);
      },

      getResetTime(): Date {
        return new Date(this.lastReset.getTime() + this.windowMs);
      },
    };
  }

  /**
   * Make API call with centralized management
   */
  async makeAPICall<T>(
    serviceName: string,
    requestFn: () => Promise<T>,
    options: APICallOptions = {},
  ): Promise<APIResponse<T>> {
    const requestId = `api-${serviceName}-${Date.now()}`;
    const startTime = Date.now();

    this.globalStats.totalRequests++;

    try {
      const serviceInstance = this.services.get(serviceName);

      if (!serviceInstance) {
        throw new Error(`Service ${serviceName} not registered`);
      }

      apiLogger.debug(`Making API call to ${serviceName}`, {
        requestId,
        serviceName,
        options,
      });

      // Rate limiting
      if (!options.skipRateLimit) {
        await serviceInstance.rateLimiter.acquire();

        if (!serviceInstance.rateLimiter.canMakeRequest()) {
          this.globalStats.rateLimitHits++;
          throw new Error(`Rate limit exceeded for ${serviceName}`);
        }
      }

      // Circuit breaker check
      if (!options.skipCircuitBreaker) {
        if (!serviceInstance.circuitBreaker.canExecute()) {
          this.globalStats.circuitBreakerTrips++;
          throw new Error(`Circuit breaker open for ${serviceName}`);
        }
      }

      // Execute request with circuit breaker
      const result = await serviceInstance.circuitBreaker.execute(requestFn);

      // Update stats
      this.globalStats.successfulRequests++;
      const processingTime = Date.now() - startTime;

      // Update service health
      this.updateServiceHealth(serviceName, true, processingTime);

      apiLogger.debug(`API call to ${serviceName} successful`, {
        requestId,
        processingTime,
        remaining: serviceInstance.rateLimiter.getRemainingRequests(),
      });

      return {
        success: true,
        data: result,
        cached: false,
        requestId,
        processingTime,
        remainingRequests: serviceInstance.rateLimiter.getRemainingRequests(),
        resetTime: serviceInstance.rateLimiter.getResetTime(),
      };
    } catch (error) {
      this.globalStats.failedRequests++;
      const processingTime = Date.now() - startTime;

      // Update service health
      this.updateServiceHealth(serviceName, false, processingTime);

      const apiError: APIError = {
        service: serviceName,
        endpoint: 'makeAPICall',
        message: error.message || 'Unknown API error',
        originalError: error,
        timestamp: new Date(),
        retryable: this.isRetryableError(error),
      };

      apiLogger.error(`API call to ${serviceName} failed`, error, {
        requestId,
        processingTime,
        retryable: apiError.retryable,
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
   * Get current weather for a course
   */
  async getCurrentWeather(
    courseId: string,
    lat: number,
    lon: number,
  ): Promise<APIResponse<WeatherData>> {
    return await this.weatherCache.getCurrentWeather(courseId, lat, lon);
  }

  /**
   * Get golf weather analysis for a course
   */
  async getGolfWeather(
    courseId: string,
    lat: number,
    lon: number,
  ): Promise<APIResponse<GolfWeatherData>> {
    return await this.weatherCache.getGolfWeather(courseId, lat, lon);
  }

  /**
   * Get course historical data from Wikipedia
   */
  async getCourseHistory(
    courseName: string,
    location: string,
  ): Promise<APIResponse<CourseHistoricalData>> {
    return await this.makeAPICall(
      'wikipedia',
      () => this.historyExtractor.extractHistoricalData(courseName, location),
      { retryAttempts: 2 },
    );
  }

  /**
   * Get course location data from OSM
   */
  async getCourseLocation(
    courseName: string,
    city: string,
    state: string,
  ): Promise<APIResponse<OSMCourseData | null>> {
    return await this.makeAPICall(
      'osm',
      () => this.osmService.findCourseLocation(courseName, city, state),
      { retryAttempts: 1, retryDelay: 3000 },
    );
  }

  /**
   * Get nearby amenities for a location
   */
  async getNearbyAmenities(
    lat: number,
    lon: number,
    radiusKm: number = 10,
  ): Promise<APIResponse<POI[]>> {
    return await this.makeAPICall(
      'osm',
      () => this.osmService.getNearbyAmenities(lat, lon, radiusKm),
      { retryAttempts: 1 },
    );
  }

  /**
   * Batch enrich multiple courses
   */
  async batchEnrichCourses(
    courses: Array<{
      id: string;
      name: string;
      location: string;
      city: string;
      state: string;
      lat?: number;
      lon?: number;
    }>,
  ): Promise<{
    successful: number;
    failed: number;
    errors: string[];
    processingTime: number;
  }> {
    const startTime = Date.now();
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
      processingTime: 0,
    };

    apiLogger.info(`Starting batch enrichment for ${courses.length} courses`);

    for (const course of courses) {
      try {
        // Process each course with appropriate delays
        const enrichmentPromises: Promise<any>[] = [];

        // Get location if not provided
        if (!course.lat || !course.lon) {
          enrichmentPromises.push(this.getCourseLocation(course.name, course.city, course.state));
        }

        // Get historical data
        enrichmentPromises.push(this.getCourseHistory(course.name, course.location));

        // Get weather data if coordinates available
        if (course.lat && course.lon) {
          enrichmentPromises.push(this.getGolfWeather(course.id, course.lat, course.lon));
        }

        const enrichmentResults = await Promise.allSettled(enrichmentPromises);

        const successfulResults = enrichmentResults.filter(
          (result) => result.status === 'fulfilled',
        ).length;

        if (successfulResults > 0) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push(`${course.name}: All enrichment attempts failed`);
        }

        // Add delay between courses to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        results.failed++;
        results.errors.push(`${course.name}: ${error.message}`);
      }
    }

    results.processingTime = Date.now() - startTime;

    apiLogger.info('Batch enrichment completed', {
      total: courses.length,
      successful: results.successful,
      failed: results.failed,
      processingTime: results.processingTime,
    });

    return results;
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(serviceName: string, success: boolean, responseTime: number): void {
    const serviceInstance = this.services.get(serviceName);
    if (!serviceInstance) return;

    const health = serviceInstance.healthStatus;

    // Update response time (rolling average)
    health.responseTime =
      health.responseTime === 0 ? responseTime : health.responseTime * 0.7 + responseTime * 0.3;

    // Update error rate (simplified)
    if (success) {
      health.errorRate = Math.max(0, health.errorRate - 0.1);
    } else {
      health.errorRate = Math.min(1, health.errorRate + 0.2);
    }

    // Update status
    if (health.errorRate > 0.5) {
      health.status = 'unhealthy';
    } else if (health.errorRate > 0.2 || health.responseTime > 10000) {
      health.status = 'degraded';
    } else {
      health.status = 'healthy';
    }

    // Update rate limit status
    health.rateLimitStatus = {
      remaining: serviceInstance.rateLimiter.getRemainingRequests(),
      resetTime: serviceInstance.rateLimiter.getResetTime(),
      withinLimits: serviceInstance.rateLimiter.canMakeRequest(),
    };

    health.lastCheck = new Date();
    serviceInstance.lastHealthCheck = new Date();
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // 5xx errors are retryable
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Rate limit errors are retryable
    if (error.message?.includes('rate limit')) {
      return true;
    }

    return false;
  }

  /**
   * Setup periodic health checking
   */
  private setupHealthChecking(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, 300000); // Every 5 minutes

    // Initial health check
    setTimeout(() => this.performHealthChecks(), 30000); // After 30 seconds
  }

  /**
   * Perform health checks on all services
   */
  private async performHealthChecks(): Promise<void> {
    apiLogger.debug('Performing health checks on all services');

    for (const [serviceName, serviceInstance] of this.services) {
      try {
        // Simple health check - just check if service responds
        if (serviceInstance.service.getHealthStatus) {
          const healthStatus = serviceInstance.service.getHealthStatus();
          serviceInstance.healthStatus.status = healthStatus.status;
          serviceInstance.healthStatus.rateLimitStatus = healthStatus.rateLimitStatus;
        }
      } catch (error) {
        apiLogger.warn(`Health check failed for ${serviceName}`, error);
        serviceInstance.healthStatus.status = 'unhealthy';
      }
    }
  }

  /**
   * Get overall health status
   */
  getHealthStatus(): HealthCheckResult {
    const services = Array.from(this.services.values()).map((instance) => instance.healthStatus);

    const healthyCount = services.filter((s) => s.status === 'healthy').length;
    const degradedCount = services.filter((s) => s.status === 'degraded').length;
    const unhealthyCount = services.filter((s) => s.status === 'unhealthy').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';

    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      services,
      timestamp: new Date(),
      uptime: Date.now() - this.globalStats.startTime.getTime(),
    };
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): {
    global: typeof this.globalStats;
    services: { [serviceName: string]: any };
    health: HealthCheckResult;
  } {
    const serviceStats: { [serviceName: string]: any } = {};

    for (const [serviceName, serviceInstance] of this.services) {
      serviceStats[serviceName] = {
        rateLimiter: {
          remaining: serviceInstance.rateLimiter.getRemainingRequests(),
          resetTime: serviceInstance.rateLimiter.getResetTime(),
          canMakeRequest: serviceInstance.rateLimiter.canMakeRequest(),
        },
        circuitBreaker: {
          isOpen: !serviceInstance.circuitBreaker.canExecute(),
        },
        health: serviceInstance.healthStatus,
        lastHealthCheck: serviceInstance.lastHealthCheck,
      };
    }

    return {
      global: { ...this.globalStats },
      services: serviceStats,
      health: this.getHealthStatus(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.globalStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitHits: 0,
      circuitBreakerTrips: 0,
      startTime: new Date(),
    };

    // Reset rate limiters
    for (const serviceInstance of this.services.values()) {
      serviceInstance.rateLimiter.requests = 0;
      serviceInstance.rateLimiter.lastReset = new Date();
    }

    apiLogger.info('API Manager statistics reset');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    apiLogger.info('Cleaning up API Manager resources');

    try {
      // Cleanup weather cache if it has cleanup method
      if (this.weatherCache && typeof this.weatherCache.clearCache === 'function') {
        this.weatherCache.clearCache();
      }

      apiLogger.info('API Manager cleanup completed');
    } catch (error) {
      apiLogger.error('Error during API Manager cleanup', error);
    }
  }
}
