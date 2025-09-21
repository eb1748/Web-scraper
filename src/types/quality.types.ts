import type { CourseType } from '@prisma/client';
import type { CourseBasicInfo } from './scraping.types';
import type { CourseEnrichmentData, CourseHistoricalData, OSMCourseData, WeatherData } from './api.types';

// Re-export commonly used types
export type { WeatherData } from './api.types';

// Media file interface
export interface MediaFile {
  id: string;
  url: string;
  alt: string;
  caption?: string;
  type: 'image' | 'video';
  size?: 'thumbnail' | 'medium' | 'large' | 'original';
}

// Combined course data for quality assessment
export interface AutomatedCourseDetails extends CourseBasicInfo {
  id: string;
  // Additional enrichment data
  enrichment?: CourseEnrichmentData;
  // Hero image for completeness scoring
  heroImageUrl?: string;
  // Quality tracking metadata
  lastValidated?: Date;
  qualityScore: number;
  completenessScore: number;
  manualReviewRequired?: boolean;
  // Additional properties for frontend components
  averageRating?: number;
  majorChampionships?: string[];
  galleryImages?: MediaFile[];
  // Required timestamp fields
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Quality metrics and scoring
export interface QualityMetrics {
  completeness: number;      // 0-100% - Required fields populated
  accuracy: number;          // 0-100% - Cross-validation score
  consistency: number;       // 0-100% - Internal consistency checks
  freshness: number;         // 0-100% - Data age and update frequency
  reliability: number;       // 0-100% - Source trustworthiness
  overallScore: number;      // Weighted average of all metrics
}

export interface QualityIssue {
  field: string;
  type: 'missing' | 'invalid' | 'inconsistent' | 'outdated' | 'unreliable';
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommendation?: string;
  affectedFields?: string[];
}

export interface QualityCheckResult {
  courseId: string;
  metrics: QualityMetrics;
  issues: QualityIssue[];
  recommendations: string[];
  manualReviewRequired: boolean;
  confidenceLevel: 'high' | 'medium' | 'low';
  lastValidated: Date;
}

// Field validation system
export interface ValidationRule {
  field: string;
  rules: Array<{
    type: 'required' | 'format' | 'range' | 'pattern' | 'cross_reference';
    params: any;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

export interface ValidationResult {
  field: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

// Cross-validation system
export interface DataSource {
  name: string;
  confidence: number;
  data: Partial<AutomatedCourseDetails>;
  timestamp: Date;
}

export interface DataConflict {
  field: string;
  values: any[];
  sources: DataSource[];
  severity: 'high' | 'medium' | 'low';
}

export interface CrossValidationResult {
  consensus: Partial<AutomatedCourseDetails>;
  conflicts: DataConflict[];
  reliability: number;
  recommendedSource: DataSource;
  confidence: number;
}

// Completeness assessment
export interface MissingFieldReport {
  field: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  suggestions: string[];
}

// Consistency validation
export interface ConsistencyIssue {
  type: 'location_mismatch' | 'yardage_inconsistency' | 'historical_inconsistency' | 'format_inconsistency';
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedFields: string[];
}

// Data enhancement
export interface DataEnhancement {
  field: string;
  action: 'generate' | 'improve' | 'standardize' | 'validate';
  originalValue: any;
  newValue: any;
  confidence: number;
  source: string;
}

export interface EnhancementResult {
  originalData: AutomatedCourseDetails;
  enhancements: DataEnhancement[];
  enhancedData: AutomatedCourseDetails;
  improvementScore: number;
}

// Quality monitoring
export interface QualityTrend {
  date: Date;
  overallScore: number;
  completeness: number;
  accuracy: number;
  coursesValidated: number;
  issuesFound: number;
  issuesResolved: number;
}

export interface QualityReport {
  summary: {
    totalCourses: number;
    averageQualityScore: number;
    coursesNeedingReview: number;
    recentlyUpdated: number;
  };
  trends: QualityTrend[];
  topIssues: QualityIssue[];
  sourceReliability: Record<string, number>;
  recommendations: string[];
}

// Configuration types
export interface QualityConfig {
  scoring: {
    weights: {
      completeness: number;
      accuracy: number;
      consistency: number;
      reliability: number;
      freshness: number;
    };
    thresholds: {
      manualReview: number;
      autoApproval: number;
      minCompleteness: number;
    };
  };
  validation: {
    requiredFields: string[];
    importantFields: string[];
    optionalFields: string[];
  };
  enhancement: {
    enabled: boolean;
    autoApply: boolean;
    confidenceThreshold: number;
  };
}