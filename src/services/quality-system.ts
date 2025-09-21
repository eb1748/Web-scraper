import { DataQualityAssessor } from './quality-assessor';
import { FieldValidator } from '../validators/field-validators';
import { CrossValidator } from './cross-validator';
import { CompletenessChecker } from './completeness-checker';
import { ConsistencyValidator } from './consistency-validator';
import { DataEnhancer } from './data-enhancer';
import { QualityMonitor } from './quality-monitor';

import type {
  AutomatedCourseDetails,
  QualityCheckResult,
  DataSource,
  CrossValidationResult,
  EnhancementResult,
  QualityReport,
  QualityConfig,
} from '../types/quality.types';

import { apiLogger } from '../utils/logger';

/**
 * Main quality system orchestrator
 * Provides a unified API for all quality assessment and improvement operations
 */
export class QualitySystem {
  private readonly assessor: DataQualityAssessor;
  private readonly fieldValidator: FieldValidator;
  private readonly crossValidator: CrossValidator;
  private readonly completenessChecker: CompletenessChecker;
  private readonly consistencyValidator: ConsistencyValidator;
  private readonly dataEnhancer: DataEnhancer;
  private readonly monitor: QualityMonitor;

  constructor(config?: Partial<QualityConfig>) {
    this.assessor = new DataQualityAssessor(config);
    this.fieldValidator = new FieldValidator();
    this.crossValidator = new CrossValidator();
    this.completenessChecker = new CompletenessChecker();
    this.consistencyValidator = new ConsistencyValidator();
    this.dataEnhancer = new DataEnhancer();
    this.monitor = new QualityMonitor();

    apiLogger.info('Quality system initialized');
  }

  /**
   * Perform comprehensive quality assessment
   */
  async assessQuality(courseData: AutomatedCourseDetails): Promise<QualityCheckResult> {
    try {
      const result = await this.assessor.assessCourseData(courseData);
      this.monitor.recordQualityAssessment(result);
      return result;
    } catch (error) {
      apiLogger.error('Quality assessment failed', error);
      throw error;
    }
  }

  /**
   * Validate course data from multiple sources
   */
  async crossValidate(sources: DataSource[]): Promise<CrossValidationResult> {
    try {
      return await this.crossValidator.validateCourseData(sources);
    } catch (error) {
      apiLogger.error('Cross-validation failed', error);
      throw error;
    }
  }

  /**
   * Enhance course data automatically
   */
  async enhanceData(
    courseData: AutomatedCourseDetails,
    autoApply: boolean = false
  ): Promise<EnhancementResult> {
    try {
      const qualityResult = await this.assessor.assessCourseData(courseData);
      const enhancement = await this.dataEnhancer.enhanceData(courseData, qualityResult);

      if (autoApply) {
        apiLogger.info(`Auto-applying ${enhancement.enhancements.length} enhancements to course ${courseData.id}`);
      }

      return enhancement;
    } catch (error) {
      apiLogger.error('Data enhancement failed', error);
      throw error;
    }
  }

  /**
   * Perform complete quality workflow: assess, enhance, re-assess
   */
  async processCourseThroughQualityWorkflow(
    courseData: AutomatedCourseDetails,
    enhanceData: boolean = true
  ): Promise<{
    original: QualityCheckResult;
    enhanced?: EnhancementResult;
    final: QualityCheckResult;
  }> {
    try {
      // Initial assessment
      const originalAssessment = await this.assessQuality(courseData);

      let enhancementResult: EnhancementResult | undefined;
      let finalData = courseData;

      // Enhance if requested and quality is below threshold
      if (enhanceData && originalAssessment.metrics.overallScore < 85) {
        enhancementResult = await this.enhanceData(courseData);
        finalData = enhancementResult.enhancedData;
      }

      // Final assessment
      const finalAssessment = await this.assessQuality(finalData);

      return {
        original: originalAssessment,
        enhanced: enhancementResult,
        final: finalAssessment,
      };
    } catch (error) {
      apiLogger.error('Quality workflow failed', error);
      throw error;
    }
  }

  /**
   * Batch process multiple courses
   */
  async batchProcess(
    courses: AutomatedCourseDetails[],
    options: {
      enhanceData?: boolean;
      crossValidate?: boolean;
      maxConcurrent?: number;
    } = {}
  ): Promise<{
    results: Array<{
      courseId: string;
      success: boolean;
      assessment?: QualityCheckResult;
      enhancement?: EnhancementResult;
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
      averageScore: number;
      coursesNeedingReview: number;
    };
  }> {
    const { enhanceData = true, maxConcurrent = 5 } = options;
    const results: Array<{
      courseId: string;
      success: boolean;
      assessment?: QualityCheckResult;
      enhancement?: EnhancementResult;
      error?: string;
    }> = [];

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < courses.length; i += maxConcurrent) {
      const batch = courses.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (course) => {
        try {
          const workflow = await this.processCourseThroughQualityWorkflow(course, enhanceData);
          return {
            courseId: course.id,
            success: true,
            assessment: workflow.final,
            enhancement: workflow.enhanced,
          };
        } catch (error) {
          return {
            courseId: course.id,
            success: false,
            error: error.message,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      apiLogger.info(`Processed batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(courses.length / maxConcurrent)}`);
    }

    // Calculate summary statistics
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const assessments = successful.filter(r => r.assessment).map(r => r.assessment!);

    const averageScore = assessments.length > 0
      ? Math.round(assessments.reduce((sum, a) => sum + a.metrics.overallScore, 0) / assessments.length)
      : 0;

    const coursesNeedingReview = assessments.filter(a => a.manualReviewRequired).length;

    return {
      results,
      summary: {
        total: courses.length,
        successful: successful.length,
        failed: failed.length,
        averageScore,
        coursesNeedingReview,
      },
    };
  }

  /**
   * Generate quality report
   */
  async generateReport(timeframe: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<QualityReport> {
    try {
      return await this.monitor.generateQualityReport(timeframe);
    } catch (error) {
      apiLogger.error('Quality report generation failed', error);
      throw error;
    }
  }

  /**
   * Get quality statistics
   */
  getStatistics(): {
    assessments: number;
    averageScore: number;
    coursesAssessed: number;
    recentActivity: number;
  } {
    return this.monitor.getCurrentStats();
  }

  /**
   * Export quality data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    return this.monitor.exportQualityData(format);
  }

  /**
   * Validate specific fields
   */
  async validateFields(courseData: AutomatedCourseDetails): Promise<Array<{
    field: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
    info: string[];
  }>> {
    try {
      return await this.fieldValidator.validateAllFields(courseData);
    } catch (error) {
      apiLogger.error('Field validation failed', error);
      throw error;
    }
  }

  /**
   * Check data completeness
   */
  checkCompleteness(courseData: AutomatedCourseDetails): {
    overall: number;
    categories: Record<string, number>;
    missing: Array<{
      field: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      suggestions: string[];
    }>;
  } {
    return {
      overall: this.completenessChecker.assessCompleteness(courseData),
      categories: this.completenessChecker.assessCompletenessByCategory(courseData),
      missing: this.completenessChecker.identifyMissingFields(courseData),
    };
  }

  /**
   * Check data consistency
   */
  checkConsistency(courseData: AutomatedCourseDetails): Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    affectedFields: string[];
  }> {
    return this.consistencyValidator.validateInternalConsistency(courseData);
  }

  /**
   * Get course quality history
   */
  getCourseHistory(courseId: string): QualityCheckResult[] {
    return this.monitor.getCourseQualityHistory(courseId);
  }

  /**
   * Clear monitoring history (for testing)
   */
  clearHistory(): void {
    this.monitor.clearHistory();
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: {
    field: string;
    rules: Array<{
      type: 'required' | 'format' | 'range' | 'pattern' | 'cross_reference';
      params: any;
      message: string;
      severity: 'error' | 'warning' | 'info';
    }>;
  }): void {
    this.fieldValidator.addValidationRule(rule);
  }

  /**
   * Configure field weights for completeness scoring
   */
  configureFieldWeight(field: string, weight: number): void {
    this.completenessChecker.setFieldWeight(field, weight);
  }

  /**
   * Configure field priority
   */
  configureFieldPriority(field: string, priority: 'critical' | 'high' | 'medium' | 'low'): void {
    this.completenessChecker.setFieldPriority(field, priority);
  }
}

// Export singleton instance
export const qualitySystem = new QualitySystem();

// Export individual components for direct access if needed
export {
  DataQualityAssessor,
  FieldValidator,
  CrossValidator,
  CompletenessChecker,
  ConsistencyValidator,
  DataEnhancer,
  QualityMonitor,
};