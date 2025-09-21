import * as dotenv from 'dotenv';
import * as Joi from 'joi';
import type { AppConfig } from '../types/config.types';

// Load environment variables
dotenv.config();

// Define validation schema
const configSchema = Joi.object({
  // Environment
  nodeEnv: Joi.string().valid('development', 'production', 'test').default('development'),
  port: Joi.number().default(3000),
  host: Joi.string().default('localhost'),

  // Database
  database: Joi.object({
    url: Joi.string().required(),
    maxConnections: Joi.number().min(1).default(10),
    connectionTimeout: Joi.number().min(1000).default(5000),
    logQueries: Joi.boolean().default(false),
  }),

  // Scraping
  scraping: Joi.object({
    requestDelayMs: Joi.number().min(100).default(2000),
    maxConcurrentRequests: Joi.number().min(1).max(10).default(3),
    retryAttempts: Joi.number().min(0).max(10).default(5),
    userAgent: Joi.string().default('Mozilla/5.0 (compatible; GolfCourseBot/1.0)'),
    circuitBreakerThreshold: Joi.number().min(0).max(1).default(0.5),
    exponentialBackoffBase: Joi.number().min(1).default(2),
    timeoutMs: Joi.number().min(5000).default(30000),
    maxRedirects: Joi.number().min(0).default(5),
    puppeteerOptions: Joi.object({
      headless: Joi.boolean().default(true),
      maxBrowserSessions: Joi.number().min(1).default(5),
      sessionTimeoutMs: Joi.number().min(30000).default(300000),
      viewportWidth: Joi.number().min(800).default(1920),
      viewportHeight: Joi.number().min(600).default(1080),
      defaultWaitTimeMs: Joi.number().min(1000).default(10000),
    }).default(),
    robotsCache: Joi.object({
      ttlHours: Joi.number().min(1).default(24),
      maxEntries: Joi.number().min(10).default(1000),
    }).default(),
    rateLimiting: Joi.object({
      defaultRequestsPerMinute: Joi.number().min(1).default(30),
      defaultRequestsPerHour: Joi.number().min(1).default(1000),
      burstAllowance: Joi.number().min(1).default(5),
    }).default(),
  }),

  // Image Processing
  images: Joi.object({
    maxWidth: Joi.number().min(100).default(1920),
    maxHeight: Joi.number().min(100).default(1440),
    quality: Joi.number().min(1).max(100).default(85),
    formats: Joi.array().items(Joi.string()).default(['webp', 'jpg']),
    thumbnailSize: Joi.number().min(50).default(200),
    heroImageMinWidth: Joi.number().min(800).default(1200),
  }),

  // Data Validation
  validation: Joi.object({
    minimumDescriptionLength: Joi.number().min(10).default(50),
    minimumImageResolution: Joi.number().min(100).default(1200),
    confidenceThreshold: Joi.number().min(0).max(100).default(70),
    qualityScoreThreshold: Joi.number().min(0).max(100).default(70),
    manualReviewThreshold: Joi.number().min(0).max(100).default(60),
  }),

  // Logging
  logging: Joi.object({
    level: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
    dir: Joi.string().default('./logs'),
    maxSize: Joi.string().default('20m'),
    maxFiles: Joi.string().default('14d'),
    datePattern: Joi.string().default('YYYY-MM-DD'),
  }),

  // APIs
  api: Joi.object({
    // Legacy compatibility
    openWeatherApiKey: Joi.string().allow('').default(''),
    openWeatherRateLimit: Joi.number().min(1).default(60),
    wikipediaRateLimit: Joi.number().min(1).default(200),
    overpassRateLimit: Joi.number().min(1).default(10),
    nominatimRateLimit: Joi.number().min(1).default(1),

    // Enhanced API configuration
    weather: Joi.object({
      enabled: Joi.boolean().default(true),
      apiKey: Joi.string().allow('').default(''),
      baseUrl: Joi.string().default('https://api.openweathermap.org/data/2.5'),
      units: Joi.string().valid('metric', 'imperial').default('imperial'),
      timeoutMs: Joi.number().min(1000).default(10000),
      includeForecastDays: Joi.number().min(1).max(5).default(3),
      golfOptimized: Joi.boolean().default(true),
      rateLimiting: Joi.object({
        requestsPerMinute: Joi.number().min(1).default(60),
        requestsPerHour: Joi.number().min(1).default(1000),
        burstAllowance: Joi.number().min(1).default(5),
        backoffMultiplier: Joi.number().min(1).default(2),
        maxRetries: Joi.number().min(0).default(3),
        baseDelayMs: Joi.number().min(100).default(1000),
      }).default(),
      circuitBreaker: Joi.object({
        threshold: Joi.number().min(0).max(1).default(0.5),
        resetTimeoutMs: Joi.number().min(5000).default(60000),
        monitoringPeriodMs: Joi.number().min(10000).default(300000),
        fallbackEnabled: Joi.boolean().default(true),
      }).default(),
      cache: Joi.object({
        currentWeatherTtlMinutes: Joi.number().min(1).default(30),
        forecastWeatherTtlHours: Joi.number().min(1).default(4),
        golfWeatherTtlMinutes: Joi.number().min(1).default(30),
        wikipediaArticleTtlHours: Joi.number().min(1).default(24),
        osmDataTtlHours: Joi.number().min(1).default(24),
        maxCacheSize: Joi.number().min(10).default(1000),
      }).default(),
    }).default(),

    wikipedia: Joi.object({
      enabled: Joi.boolean().default(true),
      baseUrl: Joi.string().default('https://en.wikipedia.org/api/rest_v1'),
      wikidataUrl: Joi.string().default('https://www.wikidata.org/w/api.php'),
      timeoutMs: Joi.number().min(1000).default(15000),
      maxSearchResults: Joi.number().min(1).default(10),
      contentExtractionTimeout: Joi.number().min(5000).default(30000),
      fallbackToWikidata: Joi.boolean().default(true),
      rateLimiting: Joi.object({
        requestsPerMinute: Joi.number().min(1).default(200),
        requestsPerHour: Joi.number().min(1).default(5000),
        burstAllowance: Joi.number().min(1).default(10),
        backoffMultiplier: Joi.number().min(1).default(2),
        maxRetries: Joi.number().min(0).default(3),
        baseDelayMs: Joi.number().min(100).default(500),
      }).default(),
      circuitBreaker: Joi.object({
        threshold: Joi.number().min(0).max(1).default(0.6),
        resetTimeoutMs: Joi.number().min(5000).default(30000),
        monitoringPeriodMs: Joi.number().min(10000).default(300000),
        fallbackEnabled: Joi.boolean().default(true),
      }).default(),
      cache: Joi.object({
        currentWeatherTtlMinutes: Joi.number().min(1).default(30),
        forecastWeatherTtlHours: Joi.number().min(1).default(4),
        golfWeatherTtlMinutes: Joi.number().min(1).default(30),
        wikipediaArticleTtlHours: Joi.number().min(1).default(24),
        osmDataTtlHours: Joi.number().min(1).default(24),
        maxCacheSize: Joi.number().min(10).default(1000),
      }).default(),
    }).default(),

    osm: Joi.object({
      enabled: Joi.boolean().default(true),
      overpassUrl: Joi.string().default('https://overpass-api.de/api/interpreter'),
      nominatimUrl: Joi.string().default('https://nominatim.openstreetmap.org'),
      timeoutMs: Joi.number().min(1000).default(25000),
      maxQueryRadius: Joi.number().min(1000).default(50000),
      searchStrategies: Joi.array().items(Joi.string().valid('exact', 'fuzzy', 'location')).default(['exact', 'fuzzy', 'location']),
      fallbackToNominatim: Joi.boolean().default(true),
      rateLimiting: Joi.object({
        requestsPerMinute: Joi.number().min(1).default(10),
        requestsPerHour: Joi.number().min(1).default(300),
        burstAllowance: Joi.number().min(1).default(2),
        backoffMultiplier: Joi.number().min(1).default(3),
        maxRetries: Joi.number().min(0).default(2),
        baseDelayMs: Joi.number().min(1000).default(6000),
      }).default(),
      circuitBreaker: Joi.object({
        threshold: Joi.number().min(0).max(1).default(0.7),
        resetTimeoutMs: Joi.number().min(5000).default(120000),
        monitoringPeriodMs: Joi.number().min(10000).default(600000),
        fallbackEnabled: Joi.boolean().default(true),
      }).default(),
      cache: Joi.object({
        currentWeatherTtlMinutes: Joi.number().min(1).default(30),
        forecastWeatherTtlHours: Joi.number().min(1).default(4),
        golfWeatherTtlMinutes: Joi.number().min(1).default(30),
        wikipediaArticleTtlHours: Joi.number().min(1).default(24),
        osmDataTtlHours: Joi.number().min(1).default(24),
        maxCacheSize: Joi.number().min(10).default(1000),
      }).default(),
    }).default(),

    enrichment: Joi.object({
      batchSize: Joi.number().min(1).default(10),
      concurrentAPICalls: Joi.number().min(1).max(5).default(2),
      skipExistingData: Joi.boolean().default(true),
      validateResults: Joi.boolean().default(true),
      minDataQualityScore: Joi.number().min(0).max(100).default(70),
      savePartialResults: Joi.boolean().default(true),
    }).default(),

    // Global API settings
    globalTimeoutMs: Joi.number().min(5000).default(30000),
    healthCheckIntervalMs: Joi.number().min(30000).default(300000),
    enableMetrics: Joi.boolean().default(true),
    logRequests: Joi.boolean().default(false),
  }),

  // Storage
  storage: Joi.object({
    dataDir: Joi.string().default('./data'),
    mediaDir: Joi.string().default('./media'),
    tempDir: Joi.string().default('./data/temp'),
    exportDir: Joi.string().default('./data/exports'),
    logsDir: Joi.string().default('./logs'),
  }),
}).unknown(false);

// Build configuration from environment variables
function buildConfig(): AppConfig {
  const rawConfig = {
    nodeEnv: process.env.NODE_ENV,
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST,

    database: {
      url: process.env.DATABASE_URL,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
      logQueries: process.env.DB_LOG_QUERIES === 'true',
    },

    scraping: {
      requestDelayMs: parseInt(process.env.SCRAPE_DELAY_MS || '2000', 10),
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3', 10),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '5', 10),
      userAgent: process.env.USER_AGENT,
      circuitBreakerThreshold: parseFloat(process.env.CIRCUIT_BREAKER_THRESHOLD || '0.5'),
      exponentialBackoffBase: parseInt(process.env.EXPONENTIAL_BACKOFF_BASE || '2', 10),
      timeoutMs: parseInt(process.env.SCRAPE_TIMEOUT_MS || '30000', 10),
      maxRedirects: parseInt(process.env.MAX_REDIRECTS || '5', 10),
      puppeteerOptions: {
        headless: process.env.PUPPETEER_HEADLESS !== 'false',
        maxBrowserSessions: parseInt(process.env.PUPPETEER_MAX_SESSIONS || '5', 10),
        sessionTimeoutMs: parseInt(process.env.PUPPETEER_SESSION_TIMEOUT || '300000', 10),
        viewportWidth: parseInt(process.env.PUPPETEER_VIEWPORT_WIDTH || '1920', 10),
        viewportHeight: parseInt(process.env.PUPPETEER_VIEWPORT_HEIGHT || '1080', 10),
        defaultWaitTimeMs: parseInt(process.env.PUPPETEER_WAIT_TIME || '10000', 10),
      },
      robotsCache: {
        ttlHours: parseInt(process.env.ROBOTS_CACHE_TTL_HOURS || '24', 10),
        maxEntries: parseInt(process.env.ROBOTS_CACHE_MAX_ENTRIES || '1000', 10),
      },
      rateLimiting: {
        defaultRequestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '30', 10),
        defaultRequestsPerHour: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '1000', 10),
        burstAllowance: parseInt(process.env.RATE_LIMIT_BURST_ALLOWANCE || '5', 10),
      },
    },

    images: {
      maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '1920', 10),
      maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '1440', 10),
      quality: parseInt(process.env.IMAGE_QUALITY || '85', 10),
      formats: (process.env.IMAGE_FORMATS || 'webp,jpg').split(','),
      thumbnailSize: parseInt(process.env.THUMBNAIL_SIZE || '200', 10),
      heroImageMinWidth: parseInt(process.env.HERO_IMAGE_MIN_WIDTH || '1200', 10),
    },

    validation: {
      minimumDescriptionLength: parseInt(process.env.MINIMUM_DESCRIPTION_LENGTH || '50', 10),
      minimumImageResolution: parseInt(process.env.MINIMUM_IMAGE_RESOLUTION || '1200', 10),
      confidenceThreshold: parseInt(process.env.CONFIDENCE_THRESHOLD || '70', 10),
      qualityScoreThreshold: parseInt(process.env.QUALITY_SCORE_THRESHOLD || '70', 10),
      manualReviewThreshold: parseInt(process.env.MANUAL_REVIEW_THRESHOLD || '60', 10),
    },

    logging: {
      level: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' || 'info',
      dir: process.env.LOG_DIR,
      maxSize: process.env.LOG_MAX_SIZE,
      maxFiles: process.env.LOG_MAX_FILES,
      datePattern: process.env.LOG_DATE_PATTERN,
    },

    api: {
      // Legacy compatibility
      openWeatherApiKey: process.env.OPENWEATHER_API_KEY || '',
      openWeatherRateLimit: parseInt(process.env.OPENWEATHER_RATE_LIMIT || '60', 10),
      wikipediaRateLimit: parseInt(process.env.WIKIPEDIA_RATE_LIMIT || '200', 10),
      overpassRateLimit: parseInt(process.env.OVERPASS_RATE_LIMIT || '10', 10),
      nominatimRateLimit: parseInt(process.env.NOMINATIM_RATE_LIMIT || '1', 10),

      // Enhanced API configuration
      weather: {
        enabled: process.env.WEATHER_API_ENABLED !== 'false',
        apiKey: process.env.OPENWEATHER_API_KEY || '',
        baseUrl: process.env.OPENWEATHER_BASE_URL || 'https://api.openweathermap.org/data/2.5',
        units: (process.env.WEATHER_UNITS as 'metric' | 'imperial') || 'imperial',
        timeoutMs: parseInt(process.env.WEATHER_TIMEOUT_MS || '10000', 10),
        includeForecastDays: parseInt(process.env.WEATHER_FORECAST_DAYS || '3', 10),
        golfOptimized: process.env.WEATHER_GOLF_OPTIMIZED !== 'false',
        rateLimiting: {
          requestsPerMinute: parseInt(process.env.WEATHER_RATE_LIMIT_PER_MINUTE || '60', 10),
          requestsPerHour: parseInt(process.env.WEATHER_RATE_LIMIT_PER_HOUR || '1000', 10),
          burstAllowance: parseInt(process.env.WEATHER_BURST_ALLOWANCE || '5', 10),
          backoffMultiplier: parseInt(process.env.WEATHER_BACKOFF_MULTIPLIER || '2', 10),
          maxRetries: parseInt(process.env.WEATHER_MAX_RETRIES || '3', 10),
          baseDelayMs: parseInt(process.env.WEATHER_BASE_DELAY_MS || '1000', 10),
        },
        circuitBreaker: {
          threshold: parseFloat(process.env.WEATHER_CIRCUIT_BREAKER_THRESHOLD || '0.5'),
          resetTimeoutMs: parseInt(process.env.WEATHER_CIRCUIT_BREAKER_RESET_MS || '60000', 10),
          monitoringPeriodMs: parseInt(process.env.WEATHER_CIRCUIT_BREAKER_MONITOR_MS || '300000', 10),
          fallbackEnabled: process.env.WEATHER_CIRCUIT_BREAKER_FALLBACK !== 'false',
        },
        cache: {
          currentWeatherTtlMinutes: parseInt(process.env.WEATHER_CACHE_CURRENT_TTL_MIN || '30', 10),
          forecastWeatherTtlHours: parseInt(process.env.WEATHER_CACHE_FORECAST_TTL_HOURS || '4', 10),
          golfWeatherTtlMinutes: parseInt(process.env.WEATHER_CACHE_GOLF_TTL_MIN || '30', 10),
          wikipediaArticleTtlHours: parseInt(process.env.CACHE_WIKIPEDIA_TTL_HOURS || '24', 10),
          osmDataTtlHours: parseInt(process.env.CACHE_OSM_TTL_HOURS || '24', 10),
          maxCacheSize: parseInt(process.env.WEATHER_CACHE_MAX_SIZE || '1000', 10),
        },
      },

      wikipedia: {
        enabled: process.env.WIKIPEDIA_API_ENABLED !== 'false',
        baseUrl: process.env.WIKIPEDIA_BASE_URL || 'https://en.wikipedia.org/api/rest_v1',
        wikidataUrl: process.env.WIKIDATA_BASE_URL || 'https://www.wikidata.org/w/api.php',
        timeoutMs: parseInt(process.env.WIKIPEDIA_TIMEOUT_MS || '15000', 10),
        maxSearchResults: parseInt(process.env.WIKIPEDIA_MAX_SEARCH_RESULTS || '10', 10),
        contentExtractionTimeout: parseInt(process.env.WIKIPEDIA_CONTENT_TIMEOUT_MS || '30000', 10),
        fallbackToWikidata: process.env.WIKIPEDIA_FALLBACK_TO_WIKIDATA !== 'false',
        rateLimiting: {
          requestsPerMinute: parseInt(process.env.WIKIPEDIA_RATE_LIMIT_PER_MINUTE || '200', 10),
          requestsPerHour: parseInt(process.env.WIKIPEDIA_RATE_LIMIT_PER_HOUR || '5000', 10),
          burstAllowance: parseInt(process.env.WIKIPEDIA_BURST_ALLOWANCE || '10', 10),
          backoffMultiplier: parseInt(process.env.WIKIPEDIA_BACKOFF_MULTIPLIER || '2', 10),
          maxRetries: parseInt(process.env.WIKIPEDIA_MAX_RETRIES || '3', 10),
          baseDelayMs: parseInt(process.env.WIKIPEDIA_BASE_DELAY_MS || '500', 10),
        },
        circuitBreaker: {
          threshold: parseFloat(process.env.WIKIPEDIA_CIRCUIT_BREAKER_THRESHOLD || '0.6'),
          resetTimeoutMs: parseInt(process.env.WIKIPEDIA_CIRCUIT_BREAKER_RESET_MS || '30000', 10),
          monitoringPeriodMs: parseInt(process.env.WIKIPEDIA_CIRCUIT_BREAKER_MONITOR_MS || '300000', 10),
          fallbackEnabled: process.env.WIKIPEDIA_CIRCUIT_BREAKER_FALLBACK !== 'false',
        },
        cache: {
          currentWeatherTtlMinutes: parseInt(process.env.CACHE_CURRENT_WEATHER_TTL_MIN || '30', 10),
          forecastWeatherTtlHours: parseInt(process.env.CACHE_FORECAST_WEATHER_TTL_HOURS || '4', 10),
          golfWeatherTtlMinutes: parseInt(process.env.CACHE_GOLF_WEATHER_TTL_MIN || '30', 10),
          wikipediaArticleTtlHours: parseInt(process.env.WIKIPEDIA_CACHE_TTL_HOURS || '24', 10),
          osmDataTtlHours: parseInt(process.env.CACHE_OSM_TTL_HOURS || '24', 10),
          maxCacheSize: parseInt(process.env.WIKIPEDIA_CACHE_MAX_SIZE || '1000', 10),
        },
      },

      osm: {
        enabled: process.env.OSM_API_ENABLED !== 'false',
        overpassUrl: process.env.OSM_OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
        nominatimUrl: process.env.OSM_NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
        timeoutMs: parseInt(process.env.OSM_TIMEOUT_MS || '25000', 10),
        maxQueryRadius: parseInt(process.env.OSM_MAX_QUERY_RADIUS || '50000', 10),
        searchStrategies: (process.env.OSM_SEARCH_STRATEGIES || 'exact,fuzzy,location').split(',') as ('exact' | 'fuzzy' | 'location')[],
        fallbackToNominatim: process.env.OSM_FALLBACK_TO_NOMINATIM !== 'false',
        rateLimiting: {
          requestsPerMinute: parseInt(process.env.OSM_RATE_LIMIT_PER_MINUTE || '10', 10),
          requestsPerHour: parseInt(process.env.OSM_RATE_LIMIT_PER_HOUR || '300', 10),
          burstAllowance: parseInt(process.env.OSM_BURST_ALLOWANCE || '2', 10),
          backoffMultiplier: parseInt(process.env.OSM_BACKOFF_MULTIPLIER || '3', 10),
          maxRetries: parseInt(process.env.OSM_MAX_RETRIES || '2', 10),
          baseDelayMs: parseInt(process.env.OSM_BASE_DELAY_MS || '6000', 10),
        },
        circuitBreaker: {
          threshold: parseFloat(process.env.OSM_CIRCUIT_BREAKER_THRESHOLD || '0.7'),
          resetTimeoutMs: parseInt(process.env.OSM_CIRCUIT_BREAKER_RESET_MS || '120000', 10),
          monitoringPeriodMs: parseInt(process.env.OSM_CIRCUIT_BREAKER_MONITOR_MS || '600000', 10),
          fallbackEnabled: process.env.OSM_CIRCUIT_BREAKER_FALLBACK !== 'false',
        },
        cache: {
          currentWeatherTtlMinutes: parseInt(process.env.CACHE_CURRENT_WEATHER_TTL_MIN || '30', 10),
          forecastWeatherTtlHours: parseInt(process.env.CACHE_FORECAST_WEATHER_TTL_HOURS || '4', 10),
          golfWeatherTtlMinutes: parseInt(process.env.CACHE_GOLF_WEATHER_TTL_MIN || '30', 10),
          wikipediaArticleTtlHours: parseInt(process.env.CACHE_WIKIPEDIA_TTL_HOURS || '24', 10),
          osmDataTtlHours: parseInt(process.env.OSM_CACHE_TTL_HOURS || '24', 10),
          maxCacheSize: parseInt(process.env.OSM_CACHE_MAX_SIZE || '1000', 10),
        },
      },

      enrichment: {
        batchSize: parseInt(process.env.ENRICHMENT_BATCH_SIZE || '10', 10),
        concurrentAPICalls: parseInt(process.env.ENRICHMENT_CONCURRENT_CALLS || '2', 10),
        skipExistingData: process.env.ENRICHMENT_SKIP_EXISTING !== 'false',
        validateResults: process.env.ENRICHMENT_VALIDATE_RESULTS !== 'false',
        minDataQualityScore: parseInt(process.env.ENRICHMENT_MIN_QUALITY_SCORE || '70', 10),
        savePartialResults: process.env.ENRICHMENT_SAVE_PARTIAL !== 'false',
      },

      // Global API settings
      globalTimeoutMs: parseInt(process.env.API_GLOBAL_TIMEOUT_MS || '30000', 10),
      healthCheckIntervalMs: parseInt(process.env.API_HEALTH_CHECK_INTERVAL_MS || '300000', 10),
      enableMetrics: process.env.API_ENABLE_METRICS !== 'false',
      logRequests: process.env.API_LOG_REQUESTS === 'true',
    },

    storage: {
      dataDir: process.env.DATA_DIR || './data',
      mediaDir: process.env.MEDIA_DIR || './media',
      tempDir: process.env.TEMP_DIR || './data/temp',
      exportDir: process.env.EXPORT_DIR || './data/exports',
      logsDir: process.env.LOG_DIR || './logs',
    },
  };

  // Validate configuration
  const { error, value } = configSchema.validate(rawConfig, { abortEarly: false });

  if (error) {
    const errors = error.details.map((detail) => detail.message).join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return value as AppConfig;
}

// Export singleton configuration
let config: AppConfig;

try {
  config = buildConfig();
} catch (error) {
  console.error('Failed to load configuration:', error);
  process.exit(1);
}

export default config;

// Helper function to get config (useful for testing)
export function getConfig(): AppConfig {
  return config;
}

// Helper function to reload config (useful for testing)
export function reloadConfig(): AppConfig {
  config = buildConfig();
  return config;
}