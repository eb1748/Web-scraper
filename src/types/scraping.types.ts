import type { CourseType } from '@prisma/client';

// Core scraping interfaces
export interface ScrapingTarget {
  id: string;
  name: string;
  url: string;
  priority: 'high' | 'medium' | 'low';
  sourceType: 'official' | 'directory' | 'community';
  selectors?: ExtractionSelectors;
  metadata?: {
    lastScraped?: Date;
    successCount: number;
    failureCount: number;
    avgResponseTime: number;
  };
}

export interface ExtractionSelectors {
  courseName?: string[];
  description?: string[];
  phone?: string[];
  email?: string[];
  address?: string[];
  pricing?: string[];
  amenities?: string[];
  images?: string[];
  architect?: string[];
  openingYear?: string[];
  yardage?: string[];
  par?: string[];
  holes?: string[];
  courseType?: string[];
  website?: string[];
  bookingUrl?: string[];
}

// Extracted data interfaces
export interface CourseBasicInfo {
  name: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  architect?: string;
  openingYear?: number;
  courseType?: CourseType;
  totalYardage?: number;
  courseRating?: number;
  slopeRating?: number;
  parScore?: number;
  numberOfHoles?: number;
  website?: string;
  phoneNumber?: string;
  emailContact?: string;
  teeTimeBookingUrl?: string;
  greensFeePriceRange?: string;
  cartRequired?: boolean;
  dressCode?: string;
  publicAccess?: boolean;
  images?: string[];
  amenities?: string[];
  confidence: number;
  source: string;
  extractedAt: Date;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  bookingUrl?: string;
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
}

export interface CourseImages {
  hero?: string[];
  gallery?: string[];
  courseMap?: string[];
  aerial?: string[];
  amenities?: string[];
}

// Scraping request and response types
export interface ScrapingRequest {
  id: string;
  target: ScrapingTarget;
  options: ScrapingOptions;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledAt?: Date;
}

export interface ScrapingOptions {
  timeout: number;
  userAgent: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  proxy?: string;
  javascript: boolean;
  waitForSelector?: string;
  waitTime?: number;
  screenshots?: boolean;
  followRedirects: boolean;
  maxRedirects: number;
}

export interface ScrapingResult {
  requestId: string;
  courseId: string;
  success: boolean;
  data?: CourseBasicInfo;
  error?: ScrapingError;
  responseTime: number;
  statusCode?: number;
  finalUrl?: string;
  redirectCount: number;
  screenshot?: string;
  timestamp: Date;
  retryCount: number;
}

export interface ScrapingError {
  type: 'network' | 'parsing' | 'validation' | 'rate_limit' | 'robots' | 'timeout' | 'javascript';
  code?: string;
  message: string;
  url: string;
  statusCode?: number;
  stack?: string;
  retryable: boolean;
  retryAfter?: number;
}

// Rate limiting and queue management
export interface RateLimitInfo {
  domain: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  currentRequests: number;
  lastReset: Date;
  blocked: boolean;
  blockedUntil?: Date;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
  successRate: number;
}

// Pattern matching and extraction
export interface ExtractionPattern {
  id: string;
  name: string;
  domain: string;
  urlPatterns: string[];
  selectors: ExtractionSelectors;
  cleaningRules: CleaningRules;
  validation: ValidationRules;
  priority: number;
  active: boolean;
  lastUpdated: Date;
  successRate: number;
}

export interface CleaningRules {
  removeElements: string[];
  removeAttributes: string[];
  textReplacements: Array<{
    pattern: string;
    replacement: string;
    flags?: string;
  }>;
  normalizeWhitespace: boolean;
  removeEmptyLines: boolean;
  trimText: boolean;
}

export interface ValidationRules {
  required: string[];
  optional: string[];
  formats: Record<string, string>; // field -> regex pattern
  ranges: Record<string, { min?: number; max?: number }>;
  customValidators: Record<string, string>; // field -> validator function name
}

// Robots.txt and compliance
export interface RobotsDirective {
  userAgent: string;
  allowed: string[];
  disallowed: string[];
  crawlDelay?: number;
  requestRate?: string;
  sitemap?: string[];
  host?: string;
}

export interface RobotsCheckResult {
  allowed: boolean;
  crawlDelay?: number;
  reason?: string;
  directive?: RobotsDirective;
  cacheHit: boolean;
  checkedAt: Date;
}

// Browser automation types
export interface BrowserSession {
  id: string;
  browser: any; // Browser instance
  pages: any[]; // Page instances
  createdAt: Date;
  lastUsed: Date;
  requestCount: number;
  maxRequests: number;
  proxy?: string;
  userAgent: string;
}

export interface PageSession {
  id: string;
  page: any; // Page instance
  sessionId: string;
  url?: string;
  createdAt: Date;
  lastUsed: Date;
  busy: boolean;
}

// Statistics and monitoring
export interface ScrapingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerMinute: number;
  errorsByType: Record<string, number>;
  domainStats: Record<
    string,
    {
      requests: number;
      success: number;
      failures: number;
      avgResponseTime: number;
      lastRequest: Date;
    }
  >;
  queueStats: QueueStats;
  browserStats: {
    activeSessions: number;
    totalSessions: number;
    avgSessionDuration: number;
    memoryUsage: number;
  };
}

// Configuration interfaces
export interface ScrapingConfig {
  requestDelayMs: number;
  maxConcurrentRequests: number;
  retryAttempts: number;
  userAgent: string;
  timeout: number;
  circuitBreakerThreshold: number;
  exponentialBackoffBase: number;
  maxQueueSize: number;
  browserPoolSize: number;
  pagePoolSize: number;
  sessionTimeout: number;
  respectRobotsTxt: boolean;
  defaultCrawlDelay: number;
  enableJavaScript: boolean;
  enableScreenshots: boolean;
  enableCookies: boolean;
  followRedirects: boolean;
  maxRedirects: number;
}

// Utility types
export type ScrapingMethod = 'static' | 'dynamic' | 'hybrid';
export type DataSource = 'official' | 'directory' | 'community' | 'api';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled';

// Event types for scraping workflow
export interface ScrapingEvent {
  type:
    | 'request_started'
    | 'request_completed'
    | 'request_failed'
    | 'queue_updated'
    | 'rate_limit_hit'
    | 'robots_blocked';
  data: any;
  timestamp: Date;
  requestId?: string;
  domain?: string;
}

// Export aggregated types
export interface ScrapingContext {
  target: ScrapingTarget;
  options: ScrapingOptions;
  pattern?: ExtractionPattern;
  session?: BrowserSession | PageSession;
  attempt: number;
  startTime: Date;
}

export interface ProcessingResult {
  success: boolean;
  data?: CourseBasicInfo;
  images?: CourseImages;
  contact?: ContactInfo;
  errors: ScrapingError[];
  warnings: string[];
  processingTime: number;
  confidence: number;
  source: string;
  metadata: {
    method: ScrapingMethod;
    pattern?: string;
    screenshots: string[];
    finalUrl: string;
    redirects: string[];
    responseSize: number;
    resourcesLoaded: number;
  };
}
