export interface PuppeteerOptions {
  headless: boolean;
  maxBrowserSessions: number;
  sessionTimeoutMs: number;
  viewportWidth: number;
  viewportHeight: number;
  defaultWaitTimeMs: number;
}

export interface RobotsCacheConfig {
  ttlHours: number;
  maxEntries: number;
}

export interface RateLimitingConfig {
  defaultRequestsPerMinute: number;
  defaultRequestsPerHour: number;
  burstAllowance: number;
}

export interface ScrapingConfig {
  requestDelayMs: number;
  maxConcurrentRequests: number;
  retryAttempts: number;
  userAgent: string;
  circuitBreakerThreshold: number;
  exponentialBackoffBase: number;
  timeoutMs: number;
  maxRedirects: number;
  puppeteerOptions: PuppeteerOptions;
  robotsCache: RobotsCacheConfig;
  rateLimiting: RateLimitingConfig;
}

export interface ImageConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  formats: string[];
  thumbnailSize: number;
  heroImageMinWidth: number;
}

export interface ValidationConfig {
  minimumDescriptionLength: number;
  minimumImageResolution: number;
  confidenceThreshold: number;
  qualityScoreThreshold: number;
  manualReviewThreshold: number;
}

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  connectionTimeout: number;
  logQueries: boolean;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  dir: string;
  maxSize: string;
  maxFiles: string;
  datePattern: string;
}

export interface CacheConfig {
  currentWeatherTtlMinutes: number;
  forecastWeatherTtlHours: number;
  golfWeatherTtlMinutes: number;
  wikipediaArticleTtlHours: number;
  osmDataTtlHours: number;
  maxCacheSize: number;
}

export interface CircuitBreakerConfig {
  threshold: number;
  resetTimeoutMs: number;
  monitoringPeriodMs: number;
  fallbackEnabled: boolean;
}

export interface ServiceRateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstAllowance: number;
  backoffMultiplier: number;
  maxRetries: number;
  baseDelayMs: number;
}

export interface APIServiceConfig {
  enabled: boolean;
  timeoutMs: number;
  rateLimiting: ServiceRateLimitConfig;
  circuitBreaker: CircuitBreakerConfig;
  cache: CacheConfig;
}

export interface WeatherAPIConfig extends APIServiceConfig {
  apiKey: string;
  baseUrl: string;
  units: 'metric' | 'imperial';
  includeForecastDays: number;
  golfOptimized: boolean;
}

export interface WikipediaAPIConfig extends APIServiceConfig {
  baseUrl: string;
  wikidataUrl: string;
  maxSearchResults: number;
  contentExtractionTimeout: number;
  fallbackToWikidata: boolean;
}

export interface OSMAPIConfig extends APIServiceConfig {
  overpassUrl: string;
  nominatimUrl: string;
  maxQueryRadius: number;
  searchStrategies: ('exact' | 'fuzzy' | 'location')[];
  fallbackToNominatim: boolean;
}

export interface DataEnrichmentConfig {
  batchSize: number;
  concurrentAPICalls: number;
  skipExistingData: boolean;
  validateResults: boolean;
  minDataQualityScore: number;
  savePartialResults: boolean;
}

export interface APIConfig {
  // Legacy compatibility
  openWeatherApiKey: string;
  openWeatherRateLimit: number;
  wikipediaRateLimit: number;
  overpassRateLimit: number;
  nominatimRateLimit: number;

  // Enhanced API configuration
  weather: WeatherAPIConfig;
  wikipedia: WikipediaAPIConfig;
  osm: OSMAPIConfig;
  enrichment: DataEnrichmentConfig;

  // Global API settings
  globalTimeoutMs: number;
  healthCheckIntervalMs: number;
  enableMetrics: boolean;
  logRequests: boolean;
}

export interface StorageConfig {
  dataDir: string;
  mediaDir: string;
  tempDir: string;
  exportDir: string;
  logsDir: string;
}

export interface AutomationConfig {
  scraping: ScrapingConfig;
  images: ImageConfig;
  validation: ValidationConfig;
  database: DatabaseConfig;
  logging: LoggingConfig;
  api: APIConfig;
  storage: StorageConfig;
}

export interface AppConfig extends AutomationConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  host: string;
}
