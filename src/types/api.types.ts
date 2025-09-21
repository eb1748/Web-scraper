// Weather API Types (OpenWeather)
export interface WeatherConditions {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGust?: number;
  conditions: string;
  description: string;
  visibility: number;
  uvIndex?: number;
  pressure: number;
  dewPoint: number;
}

export interface WeatherForecastDay {
  date: string;
  tempHigh: number;
  tempLow: number;
  precipitation: number;
  precipitationProbability: number;
  conditions: string;
  description: string;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  uvIndex?: number;
}

export interface WeatherData {
  current: WeatherConditions;
  forecast: WeatherForecastDay[];
  location: {
    latitude: number;
    longitude: number;
    name: string;
    country: string;
    timezone: string;
  };
  lastUpdated: Date;
  source: 'openweather' | 'weatherapi' | 'visualcrossing';
}

export interface OpenWeatherResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  visibility: number;
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  name: string;
}

export interface OpenWeatherForecastResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      humidity: number;
    };
    weather: Array<{
      main: string;
      description: string;
      icon: string;
    }>;
    wind: {
      speed: number;
      deg: number;
    };
    pop: number; // Probability of precipitation
    dt_txt: string;
  }>;
  city: {
    name: string;
    country: string;
    timezone: number;
  };
}

// Wikipedia API Types
export interface WikipediaSearchResult {
  title: string;
  snippet: string;
  size: number;
  wordcount: number;
}

export interface WikipediaSearchResponse {
  query: {
    search: WikipediaSearchResult[];
  };
}

export interface WikipediaPageResponse {
  parse: {
    title: string;
    text: {
      '*': string;
    };
    categories: Array<{
      '*': string;
    }>;
    sections: Array<{
      index: string;
      level: string;
      line: string;
    }>;
  };
}

export interface WikidataResponse {
  entities: {
    [key: string]: {
      labels: {
        [lang: string]: {
          value: string;
        };
      };
      claims: {
        [property: string]: Array<{
          mainsnak: {
            datavalue?: {
              value: any;
            };
          };
        }>;
      };
    };
  };
}

export interface WikipediaData {
  summary: string;
  history: string;
  architect: string;
  openingYear: number;
  majorChampionships: string[];
  notableEvents: string[];
  references: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  images: string[];
  lastUpdated: Date;
}

export interface CourseHistoricalData {
  architect: string;
  coArchitects: string[];
  openingYear: number;
  renovationYears: number[];
  renovationArchitects: string[];
  majorChampionships: Array<{
    tournament: string;
    years: number[];
    winners: Array<{
      year: number;
      winner: string;
      score?: string;
    }>;
  }>;
  designPhilosophy: string;
  notableFeatures: string[];
  records: Array<{
    type: string;
    value: string;
    holder: string;
    date: string;
  }>;
  courseChanges: Array<{
    year: number;
    description: string;
    architect?: string;
  }>;
}

// OpenStreetMap / Overpass API Types
export interface OSMNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags: { [key: string]: string };
}

export interface OSMWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags: { [key: string]: string };
  geometry?: Array<{
    lat: number;
    lon: number;
  }>;
}

export interface OSMRelation {
  type: 'relation';
  id: number;
  members: Array<{
    type: 'node' | 'way' | 'relation';
    ref: number;
    role: string;
  }>;
  tags: { [key: string]: string };
}

export interface OverpassResponse {
  elements: (OSMNode | OSMWay | OSMRelation)[];
}

export interface POI {
  id: string;
  name: string;
  type: string;
  coordinates: [number, number];
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  distance: number; // in meters
  tags: { [key: string]: string };
}

export interface OSMCourseData {
  coordinates: [number, number];
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  address: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  amenities: string[];
  features: string[];
  nearbyFeatures: {
    hotels: POI[];
    restaurants: POI[];
    airports: POI[];
    attractions: POI[];
  };
  accessibility: {
    wheelchair?: boolean;
    parking?: boolean;
    publicTransport?: POI[];
  };
  lastUpdated: Date;
}

// Generic API Management Types
export interface APIError {
  service: string;
  endpoint: string;
  statusCode?: number;
  message: string;
  originalError: any;
  timestamp: Date;
  retryable: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  cached: boolean;
  requestId: string;
  processingTime: number;
  remainingRequests?: number;
  resetTime?: Date;
}

export interface RateLimiter {
  requests: number;
  windowMs: number;
  maxRequests: number;
  burstAllowance: number;
  lastReset: Date;
  acquire(): Promise<void>;
  canMakeRequest(): boolean;
  getRemainingRequests(): number;
  getResetTime(): Date;
}

export interface APIServiceConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour?: number;
    burstAllowance?: number;
  };
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  headers?: { [key: string]: string };
}

// Caching Types
export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
  hits: number;
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  checkPeriod: number; // How often to check for expired entries
  useClones: boolean;
  deleteOnExpire: boolean;
}

// Data Enrichment Types
export interface CourseEnrichmentData {
  weather?: WeatherData;
  historical?: CourseHistoricalData;
  location?: OSMCourseData;
  enrichmentMetadata: {
    sources: string[];
    lastUpdated: Date;
    confidence: number;
    dataCompleteness: number;
    errors: string[];
  };
}

export interface EnrichmentResult {
  courseId: string;
  success: boolean;
  data?: CourseEnrichmentData;
  errors: APIError[];
  processingTime: number;
  apiCallsUsed: {
    weather: number;
    wikipedia: number;
    osm: number;
  };
}

export interface EnrichmentSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  totalCourses: number;
  processedCourses: number;
  successfulEnrichments: number;
  failedEnrichments: number;
  apiCallsUsed: {
    weather: number;
    wikipedia: number;
    osm: number;
  };
  errors: APIError[];
  averageProcessingTime: number;
}

// Golf-Specific Weather Types
export interface GolfWeatherConditions {
  playability: 'excellent' | 'good' | 'marginal' | 'poor' | 'unplayable';
  windImpact: 'minimal' | 'moderate' | 'significant' | 'severe';
  temperatureComfort: 'cold' | 'cool' | 'comfortable' | 'warm' | 'hot';
  precipitationRisk: 'none' | 'light' | 'moderate' | 'heavy';
  recommendations: string[];
  alerts: string[];
}

export interface GolfWeatherData extends WeatherData {
  golfConditions: GolfWeatherConditions;
  forecastSummary: {
    bestDays: string[];
    worstDays: string[];
    weekendOutlook: string;
  };
}

// Validation and Cleaning Types
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cleaned: boolean;
  originalValue: any;
  cleanedValue: any;
}

export interface DataValidator<T> {
  validate(data: T): ValidationResult;
  clean(data: T): T;
  isValid(data: T): boolean;
}

// Service Health Types
export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  errorRate: number;
  rateLimitStatus: {
    remaining: number;
    resetTime: Date;
    withinLimits: boolean;
  };
}

export interface HealthCheckResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: Date;
  uptime: number;
}
