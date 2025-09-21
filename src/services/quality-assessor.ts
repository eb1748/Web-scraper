import type {
  AutomatedCourseDetails,
  QualityMetrics,
  QualityCheckResult,
  QualityIssue,
  QualityConfig,
} from '../types/quality.types';
import { apiLogger } from '../utils/logger';

/**
 * Main data quality assessment service
 * Orchestrates all quality checks and scoring algorithms
 */
export class DataQualityAssessor {
  private readonly config: QualityConfig;

  private readonly requiredFields = [
    'name', 'location', 'latitude', 'longitude',
    'description', 'website', 'phoneNumber'
  ];

  private readonly importantFields = [
    'architect', 'openingYear', 'courseType',
    'totalYardage', 'parScore', 'heroImageUrl'
  ];

  private readonly optionalFields = [
    'numberOfHoles', 'courseRating', 'slopeRating',
    'greensFeePriceRange', 'amenities', 'emailContact'
  ];

  constructor(config?: Partial<QualityConfig>) {
    this.config = {
      scoring: {
        weights: {
          completeness: 0.30,
          accuracy: 0.25,
          consistency: 0.20,
          reliability: 0.15,
          freshness: 0.10,
        },
        thresholds: {
          manualReview: 70,
          autoApproval: 90,
          minCompleteness: 75,
        },
      },
      validation: {
        requiredFields: this.requiredFields,
        importantFields: this.importantFields,
        optionalFields: this.optionalFields,
      },
      enhancement: {
        enabled: true,
        autoApply: false,
        confidenceThreshold: 0.8,
      },
      ...config,
    };
  }

  /**
   * Perform comprehensive quality assessment on course data
   */
  async assessCourseData(courseData: AutomatedCourseDetails): Promise<QualityCheckResult> {
    const startTime = Date.now();

    try {
      const metrics = await this.calculateMetrics(courseData);
      const issues = this.identifyIssues(courseData, metrics);
      const recommendations = this.generateRecommendations(issues);

      const result: QualityCheckResult = {
        courseId: courseData.id,
        metrics,
        issues,
        recommendations,
        manualReviewRequired: metrics.overallScore < this.config.scoring.thresholds.manualReview,
        confidenceLevel: this.getConfidenceLevel(metrics.overallScore),
        lastValidated: new Date(),
      };

      apiLogger.info(`Quality assessment completed for course ${courseData.id}`, {
        overallScore: metrics.overallScore,
        issuesFound: issues.length,
        processingTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      apiLogger.error(`Quality assessment failed for course ${courseData.id}`, error);
      throw error;
    }
  }

  /**
   * Calculate all quality metrics
   */
  private async calculateMetrics(data: AutomatedCourseDetails): Promise<QualityMetrics> {
    const completeness = this.assessCompleteness(data);
    const accuracy = await this.assessAccuracy(data);
    const consistency = this.assessConsistency(data);
    const freshness = this.assessFreshness(data);
    const reliability = this.assessReliability(data);

    const weights = this.config.scoring.weights;
    const overallScore = Math.round(
      completeness * weights.completeness +
      accuracy * weights.accuracy +
      consistency * weights.consistency +
      reliability * weights.reliability +
      freshness * weights.freshness
    );

    return {
      completeness,
      accuracy,
      consistency,
      freshness,
      reliability,
      overallScore,
    };
  }

  /**
   * Assess data completeness based on field weights
   */
  private assessCompleteness(data: AutomatedCourseDetails): number {
    const fieldWeights = {
      // Critical fields (high weight)
      name: 10,
      location: 10,
      latitude: 10,
      longitude: 10,

      // Important fields (medium weight)
      description: 5,
      website: 5,
      phoneNumber: 5,
      architect: 3,
      openingYear: 3,

      // Nice-to-have fields (low weight)
      totalYardage: 1,
      courseType: 2,
      heroImageUrl: 3,
      greensFeePriceRange: 2,
      numberOfHoles: 1,
      courseRating: 1,
      slopeRating: 1,
      parScore: 2,
      amenities: 1,
    };

    let totalWeight = 0;
    let filledWeight = 0;

    for (const [field, weight] of Object.entries(fieldWeights)) {
      totalWeight += weight;

      const value = data[field as keyof AutomatedCourseDetails];
      if (this.isFieldComplete(value)) {
        filledWeight += weight;
      }
    }

    return Math.round((filledWeight / totalWeight) * 100);
  }

  /**
   * Assess data accuracy through various checks
   */
  private async assessAccuracy(data: AutomatedCourseDetails): Promise<number> {
    let score = 100;
    let checks = 0;

    // Coordinate validation
    if (data.latitude && data.longitude) {
      checks++;
      if (!this.isValidCoordinate(data.latitude, data.longitude)) {
        score -= 20;
      }
    }

    // URL validation
    if (data.website) {
      checks++;
      if (!this.isValidUrl(data.website)) {
        score -= 15;
      }
    }

    // Phone number format validation
    if (data.phoneNumber) {
      checks++;
      if (!this.isValidPhoneNumber(data.phoneNumber)) {
        score -= 10;
      }
    }

    // Year validation
    if (data.openingYear) {
      checks++;
      if (!this.isValidYear(data.openingYear)) {
        score -= 15;
      }
    }

    // Golf course data validation
    if (data.totalYardage && data.numberOfHoles) {
      checks++;
      const avgYardage = data.totalYardage / data.numberOfHoles;
      if (avgYardage < 200 || avgYardage > 600) {
        score -= 10;
      }
    }

    // Ensure minimum score
    return Math.max(0, Math.round(score));
  }

  /**
   * Assess internal data consistency
   */
  private assessConsistency(data: AutomatedCourseDetails): number {
    let score = 100;

    // Location consistency (basic check)
    if (data.latitude && data.longitude && data.location) {
      // Simple US bounds check
      const isUSCoordinate =
        data.latitude >= 24.7433195 && data.latitude <= 49.3457868 &&
        data.longitude >= -124.7844079 && data.longitude <= -66.9513812;

      if (!isUSCoordinate && data.location.includes('United States')) {
        score -= 15;
      }
    }

    // Golf course metrics consistency
    if (data.totalYardage && data.numberOfHoles) {
      const avgYardagePerHole = data.totalYardage / data.numberOfHoles;
      if (avgYardagePerHole < 200 || avgYardagePerHole > 600) {
        score -= 10;
      }
    }

    // Par score consistency
    if (data.parScore && data.numberOfHoles) {
      const avgParPerHole = data.parScore / data.numberOfHoles;
      if (avgParPerHole < 3 || avgParPerHole > 5) {
        score -= 10;
      }
    }

    // Rating consistency
    if (data.courseRating && data.slopeRating) {
      if (data.courseRating < 60 || data.courseRating > 80) {
        score -= 5;
      }
      if (data.slopeRating < 55 || data.slopeRating > 155) {
        score -= 5;
      }
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Assess data freshness based on timestamps
   */
  private assessFreshness(data: AutomatedCourseDetails): number {
    const now = new Date();
    const extractedAt = data.extractedAt;
    const lastValidated = data.lastValidated;

    // Use the most recent timestamp
    const mostRecentUpdate = lastValidated && lastValidated > extractedAt
      ? lastValidated
      : extractedAt;

    const hoursSinceUpdate = (now.getTime() - mostRecentUpdate.getTime()) / (1000 * 60 * 60);
    const daysSinceUpdate = hoursSinceUpdate / 24;

    // Scoring based on age
    if (daysSinceUpdate <= 1) return 100;
    if (daysSinceUpdate <= 7) return 90;
    if (daysSinceUpdate <= 30) return 80;
    if (daysSinceUpdate <= 90) return 70;
    if (daysSinceUpdate <= 180) return 60;
    if (daysSinceUpdate <= 365) return 50;

    return 30; // Very old data
  }

  /**
   * Assess source reliability
   */
  private assessReliability(data: AutomatedCourseDetails): number {
    let score = 100;

    // Source type scoring
    if (data.source) {
      if (data.source.includes('official') || data.source.includes('pga')) {
        score = 95;
      } else if (data.source.includes('golflink') || data.source.includes('golf.com')) {
        score = 85;
      } else if (data.source.includes('directory')) {
        score = 75;
      } else if (data.source.includes('community') || data.source.includes('user-generated')) {
        score = 65;
      }
    }

    // Confidence factor
    if (data.confidence) {
      score = Math.round(score * (data.confidence / 100));
    }

    return Math.max(30, score); // Minimum reliability score
  }

  /**
   * Identify specific quality issues
   */
  private identifyIssues(data: AutomatedCourseDetails, _metrics: QualityMetrics): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Completeness issues
    this.requiredFields.forEach(field => {
      const value = data[field as keyof AutomatedCourseDetails];
      if (!this.isFieldComplete(value)) {
        issues.push({
          field,
          type: 'missing',
          severity: 'error',
          message: `Required field '${field}' is missing`,
          recommendation: `Obtain ${field} from official course website or directory`,
        });
      }
    });

    // Accuracy issues
    if (data.latitude && data.longitude && !this.isValidCoordinate(data.latitude, data.longitude)) {
      issues.push({
        field: 'coordinates',
        type: 'invalid',
        severity: 'error',
        message: 'Invalid coordinate values',
        affectedFields: ['latitude', 'longitude'],
      });
    }

    if (data.website && !this.isValidUrl(data.website)) {
      issues.push({
        field: 'website',
        type: 'invalid',
        severity: 'warning',
        message: 'Website URL appears to be invalid',
      });
    }

    // Consistency issues
    if (data.totalYardage && data.numberOfHoles) {
      const avgYardage = data.totalYardage / data.numberOfHoles;
      if (avgYardage < 200 || avgYardage > 600) {
        issues.push({
          field: 'totalYardage',
          type: 'inconsistent',
          severity: 'warning',
          message: `Average yardage per hole (${Math.round(avgYardage)}) seems unusual`,
          affectedFields: ['totalYardage', 'numberOfHoles'],
        });
      }
    }

    // Freshness issues
    const daysSinceUpdate = (Date.now() - data.extractedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 180) {
      issues.push({
        field: 'lastUpdated',
        type: 'outdated',
        severity: 'info',
        message: `Data is ${Math.round(daysSinceUpdate)} days old`,
        recommendation: 'Consider refreshing course data',
      });
    }

    return issues;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(issues: QualityIssue[]): string[] {
    const recommendations: string[] = [];
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    if (errorCount > 0) {
      recommendations.push(`Address ${errorCount} critical data errors before publication`);
    }

    if (warningCount > 3) {
      recommendations.push(`Review ${warningCount} data quality warnings`);
    }

    // Specific recommendations based on missing critical fields
    const missingCritical = issues.filter(i =>
      i.type === 'missing' &&
      i.severity === 'error' &&
      this.requiredFields.includes(i.field)
    );

    if (missingCritical.length > 0) {
      recommendations.push('Prioritize collecting missing required fields from official sources');
    }

    // Image recommendation
    const hasImageIssues = issues.some(i => i.field === 'heroImageUrl');
    if (hasImageIssues) {
      recommendations.push('Add high-quality hero image for better presentation');
    }

    return recommendations;
  }

  /**
   * Determine confidence level based on overall score
   */
  private getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 85) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }

  // Utility validation methods
  private isFieldComplete(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }

  private isValidCoordinate(lat: number, lon: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180 &&
      !isNaN(lat) &&
      !isNaN(lon)
    );
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic US phone number validation
    const phoneRegex = /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  private isValidYear(year: number): boolean {
    const currentYear = new Date().getFullYear();
    return (
      typeof year === 'number' &&
      year >= 1850 && // Earliest golf courses
      year <= currentYear &&
      !isNaN(year)
    );
  }
}

// Export singleton instance
export const qualityAssessor = new DataQualityAssessor();