import type { QualityMetrics, QualityIssue } from './quality.types';
import type { WeatherData } from './api.types';
import type { CourseBasicInfo } from './scraping.types';

// ===== AUTOMATION ORCHESTRATION TYPES =====

export interface CourseTarget {
  id: string;
  name: string;
  location: string;
  website?: string;
  latitude?: number;
  longitude?: number;
}

export interface AutomationConfig {
  courses: CourseTarget[];
  batchSize: number;
  concurrency: number;
  retryAttempts: number;
  qualityThreshold: number;
  updateFrequency: 'daily' | 'weekly' | 'monthly';
  enabledServices: {
    scraping: boolean;
    weatherUpdates: boolean;
    historyEnrichment: boolean;
    imageProcessing: boolean;
    seoGeneration: boolean;
  };
}

export interface CourseProcessingResult {
  courseId: string;
  success: boolean;
  qualityScore?: number;
  dataCollected?: number;
  issues?: QualityIssue[];
  processingTime: number;
  error?: string;
  steps: {
    dataCollection?: StepResult;
    validation?: StepResult;
    enhancement?: StepResult;
    imageProcessing?: StepResult;
    seoGeneration?: StepResult;
  };
}

export interface StepResult {
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

export interface AutomationResult {
  startTime: number;
  endTime: number;
  totalDuration: number;
  totalCourses: number;
  successfulCourses: number;
  failedCourses: number;
  averageQualityScore: number;
  totalIssues: number;
  batchResults: CourseProcessingResult[];
  summary: string;
}

// ===== DATA COLLECTION TYPES =====

export interface CollectedData {
  id: string;
  name: string;
  sources: string[];
  confidence: number;
  websiteData?: WebsiteData;
  wikipediaData?: WikipediaData;
  weatherData?: WeatherData;
  locationData?: LocationData;
  historicalData?: HistoricalData;
  imageData?: ImageData[];
  collectedAt: Date;
}

export interface WebsiteData {
  url: string;
  title?: string;
  description?: string;
  contact?: ContactInfo;
  amenities?: string[];
  pricing?: PricingInfo;
  images?: string[];
  policies?: string[];
  lastScraped: Date;
  scrapingSuccess: boolean;
  error?: string;
}

export interface WikipediaData {
  title: string;
  extract: string;
  architects?: string[];
  yearOpened?: number;
  championships?: string[];
  images?: string[];
  infobox?: Record<string, any>;
  lastUpdated: Date;
  confidence: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  nearbyAmenities?: NearbyAmenity[];
  osmData?: any;
}

export interface HistoricalData {
  events?: ChampionshipEvent[];
  renovations?: RenovationEvent[];
  architects?: string[];
  yearOpened?: number;
  yearClosed?: number;
  notableFeatures?: string[];
}

export interface ImageData {
  url: string;
  alt?: string;
  caption?: string;
  category: 'hero' | 'gallery' | 'map' | 'amenity';
  source: string;
  downloadStatus: 'pending' | 'success' | 'failed';
  localPath?: string;
  error?: string;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

export interface PricingInfo {
  greenFees?: string;
  cartRental?: string;
  membershipTypes?: string[];
  seasonalRates?: boolean;
}

export interface NearbyAmenity {
  name: string;
  type: string;
  distance: number;
  rating?: number;
}

export interface ChampionshipEvent {
  name: string;
  year: number;
  winner?: string;
  type: 'major' | 'pga' | 'amateur' | 'other';
}

export interface RenovationEvent {
  year: number;
  architect?: string;
  description?: string;
  scope: 'major' | 'minor' | 'redesign';
}

// ===== SCHEDULING TYPES =====

export interface ScheduledTask {
  id: string;
  name: string;
  script: string;
  args: string[];
  priority: 'high' | 'medium' | 'low';
  maxDuration: number;
  retryOnFailure: boolean;
  schedule: string; // cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'pending' | 'running' | 'success' | 'failed';
}

export interface ScheduleConfig {
  dailyTasks: ScheduledTask[];
  weeklyTasks: ScheduledTask[];
  monthlyTasks: ScheduledTask[];
  timezone: string;
  notificationEmails: string[];
}

export interface TaskExecution {
  taskId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'success' | 'failed';
  output?: string;
  error?: string;
  retryCount: number;
}

// ===== MONITORING TYPES =====

export interface HealthMetrics {
  system: SystemMetrics;
  database: DatabaseMetrics;
  automation: AutomationMetrics;
  api: APIMetrics;
  storage: StorageMetrics;
  timestamp: Date;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  load: number[];
  uptime: number;
}

export interface DatabaseMetrics {
  connectionCount: number;
  activeConnections: number;
  queryTime: number;
  errorRate: number;
  totalQueries: number;
  slowQueries: number;
}

export interface AutomationMetrics {
  tasksRunning: number;
  tasksQueued: number;
  tasksCompleted: number;
  lastSuccessfulRun?: Date;
  failureRate: number;
  averageProcessingTime: number;
}

export interface APIMetrics {
  weatherApiStatus: 'up' | 'down' | 'degraded';
  wikipediaApiStatus: 'up' | 'down' | 'degraded';
  osmApiStatus: 'up' | 'down' | 'degraded';
  responseTime: number;
  requestCount: number;
  errorCount: number;
  rateLimitHits: number;
}

export interface StorageMetrics {
  totalSize: number;
  usedSize: number;
  availableSize: number;
  imageCount: number;
  tempFileCount: number;
  logFileCount: number;
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  category: 'system' | 'database' | 'automation' | 'api' | 'storage';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

// ===== PROGRESS TRACKING TYPES =====

export interface ProgressReport {
  reportId: string;
  timestamp: Date;
  totalCourses: number;
  processedCourses: number;
  successfulCourses: number;
  failedCourses: number;
  averageQualityScore: number;
  estimatedCompletion?: Date;
  recentIssues: QualityIssue[];
  performanceMetrics: PerformanceMetrics;
  currentBatch?: BatchProgress;
}

export interface PerformanceMetrics {
  avgProcessingTime: number;
  dataCompleteness: number;
  imageProcessingSuccess: number;
  apiSuccessRate: number;
  scrapeSuccessRate: number;
  enhancementSuccess: number;
}

export interface BatchProgress {
  batchId: string;
  startTime: Date;
  totalCourses: number;
  completedCourses: number;
  currentCourse?: string;
  estimatedTimeRemaining?: number;
  errors: string[];
}

// ===== MAINTENANCE TYPES =====

export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'filesystem' | 'logs' | 'cache' | 'images';
  frequency: 'daily' | 'weekly' | 'monthly';
  lastRun?: Date;
  nextRun?: Date;
  status: 'pending' | 'running' | 'success' | 'failed';
  config: MaintenanceConfig;
}

export interface MaintenanceConfig {
  retentionDays?: number;
  cleanupThreshold?: number;
  optimizeIndexes?: boolean;
  compressLogs?: boolean;
  archiveData?: boolean;
  [key: string]: any;
}

export interface MaintenanceResult {
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  itemsProcessed: number;
  itemsRemoved: number;
  spaceSaved?: number;
  errors: string[];
  warnings: string[];
}

// ===== NOTIFICATION TYPES =====

export interface NotificationConfig {
  enabled: boolean;
  email: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
    };
    from: string;
    to: string[];
    subject: string;
  };
  slack?: {
    webhookUrl: string;
    channel: string;
    username: string;
  };
}

export interface Notification {
  id: string;
  type: 'email' | 'slack' | 'webhook';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  sent: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// ===== QUEUE TYPES =====

export interface QueueJob {
  id: string;
  type: 'scrape' | 'enrich' | 'process-images' | 'generate-seo' | 'validate' | 'maintenance';
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay?: number;
  backoff?: 'fixed' | 'exponential';
  createdAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

// ===== CONFIGURATION TYPES =====

export interface AutomationSettings {
  enabled: boolean;
  maxConcurrentTasks: number;
  retryAttempts: number;
  timeoutDuration: number;
  rateLimits: Record<string, number>;
  maintenance: {
    enabled: boolean;
    schedule: string;
    retentionDays: number;
  };
  monitoring: {
    healthCheckInterval: number;
    alertThresholds: {
      cpu: number;
      memory: number;
      disk: number;
      errorRate: number;
    };
  };
  notifications: NotificationConfig;
}

// ===== EVENT TYPES =====

export interface AutomationEvent {
  id: string;
  type: 'task_started' | 'task_completed' | 'task_failed' | 'batch_started' | 'batch_completed' | 'alert_triggered' | 'maintenance_started' | 'maintenance_completed';
  entityId: string;
  entityType: 'task' | 'batch' | 'course' | 'system';
  timestamp: Date;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EventListener {
  eventType: string;
  handler: (event: AutomationEvent) => Promise<void>;
  priority: number;
}