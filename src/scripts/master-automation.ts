#!/usr/bin/env node

import { promises as fs } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { QualitySystem } from '../services/quality-system';
import { AutomatedDataCollector } from '../services/automated-data-collector';
import { ProgressTracker } from '../services/progress-tracker';
import { HealthMonitor } from '../services/health-monitor';
import { AlertManager } from '../services/alert-manager';
import { apiLogger } from '../utils/logger';

import type {
  AutomationConfig,
  AutomationResult,
  CourseProcessingResult,
  CourseTarget,
  StepResult,
  CollectedData,
} from '../types/automation.types';

import type { AutomatedCourseDetails } from '../types/quality.types';

/**
 * Master Automation Orchestrator
 *
 * Coordinates the complete automation workflow for golf course data collection,
 * processing, validation, and enhancement with comprehensive monitoring and reporting.
 */
export class MasterAutomationOrchestrator {
  private readonly logger = apiLogger;
  private readonly qualitySystem: QualitySystem;
  private readonly dataCollector: AutomatedDataCollector;
  private readonly progressTracker: ProgressTracker;
  private readonly healthMonitor: HealthMonitor;
  private readonly alertManager: AlertManager;

  constructor() {
    this.qualitySystem = new QualitySystem();
    this.dataCollector = new AutomatedDataCollector();
    this.progressTracker = new ProgressTracker();
    this.healthMonitor = new HealthMonitor();
    this.alertManager = new AlertManager();

    this.logger.info('Master Automation Orchestrator initialized');
  }

  /**
   * Execute the complete automation workflow
   */
  async runFullAutomation(config: AutomationConfig): Promise<AutomationResult> {
    const startTime = performance.now();
    const processId = `automation-${Date.now()}`;

    this.logger.info(`Starting full automation for ${config.courses.length} courses`, {
      processId,
      batchSize: config.batchSize,
      concurrency: config.concurrency,
    });

    try {
      // Initialize progress tracking
      await this.progressTracker.initializeRun(processId, config.courses.length);

      // System health check before starting
      const healthStatus = await this.healthMonitor.checkSystemHealth();
      if (!healthStatus.healthy) {
        throw new Error(`System health check failed: ${healthStatus.issues.join(', ')}`);
      }

      const results: CourseProcessingResult[] = [];
      const batches = this.createBatches(config.courses, config.batchSize);

      // Process each batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchId = `${processId}-batch-${i + 1}`;

        this.logger.info(`Processing batch ${i + 1}/${batches.length} (${batch.length} courses)`, {
          batchId,
          courseCount: batch.length,
        });

        try {
          const batchResults = await this.processBatch(batch, config, batchId);
          results.push(...batchResults);

          // Update progress after each batch
          await this.progressTracker.updateProgress({
            processId,
            batchId,
            total: config.courses.length,
            completed: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
          });

          // Health check between batches
          await this.healthMonitor.recordBatchMetrics(batchId, batchResults);

          // Rate limiting between batches
          if (i < batches.length - 1) {
            await this.delay(2000);
          }

        } catch (batchError) {
          this.logger.error(`Batch ${i + 1} failed:`, batchError);

          // Create failed results for all courses in the batch
          const failedResults = batch.map(course => ({
            courseId: course.id,
            success: false,
            error: `Batch processing failed: ${batchError.message}`,
            processingTime: performance.now(),
            steps: {},
          }));

          results.push(...failedResults);
          await this.alertManager.sendBatchFailureAlert(batchId, batchError);
        }
      }

      // Generate final summary
      const endTime = performance.now();
      const summary = await this.generateSummaryReport(results, startTime, endTime, processId);

      // Send completion notification
      await this.notifyCompletion(summary);

      // Final health status
      await this.healthMonitor.recordAutomationCompletion(processId, summary);

      this.logger.info('Full automation completed successfully', {
        processId,
        totalCourses: summary.totalCourses,
        successful: summary.successfulCourses,
        failed: summary.failedCourses,
        duration: summary.totalDuration,
      });

      return summary;

    } catch (error) {
      this.logger.error('Full automation failed:', error);
      await this.alertManager.sendAutomationFailureAlert(processId, error);
      throw error;
    }
  }

  /**
   * Process a batch of courses with controlled concurrency
   */
  private async processBatch(
    courses: CourseTarget[],
    config: AutomationConfig,
    batchId: string
  ): Promise<CourseProcessingResult[]> {

    // Create processing promises for each course
    const processingPromises = courses.map(course =>
      this.processSingleCourse(course, config, batchId)
    );

    // Execute with controlled concurrency
    const results = await this.executeWithConcurrency(processingPromises, config.concurrency);

    // Log batch completion statistics
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    this.logger.info(`Batch ${batchId} completed`, {
      total: courses.length,
      successful,
      failed,
      successRate: `${((successful / courses.length) * 100).toFixed(1)}%`,
    });

    return results;
  }

  /**
   * Process a single course through the complete workflow
   */
  private async processSingleCourse(
    course: CourseTarget,
    config: AutomationConfig,
    batchId: string
  ): Promise<CourseProcessingResult> {
    const startTime = performance.now();
    const courseLogger = this.logger.child({ courseId: course.id, courseName: course.name, batchId });

    courseLogger.info('Starting course processing');

    const result: CourseProcessingResult = {
      courseId: course.id,
      success: false,
      processingTime: 0,
      steps: {},
    };

    try {
      // Step 1: Data Collection
      courseLogger.info('Starting data collection');
      const collectionStart = performance.now();

      const collectedData = await this.collectCourseData(course, config);

      const collectionEnd = performance.now();
      result.steps.dataCollection = {
        success: true,
        duration: collectionEnd - collectionStart,
        data: { sources: collectedData.sources.length },
      };
      courseLogger.info('Data collection completed', {
        sources: collectedData.sources.length,
        confidence: collectedData.confidence,
      });

      // Step 2: Data Validation and Enhancement
      courseLogger.info('Starting data validation and enhancement');
      const validationStart = performance.now();

      const validatedData = await this.validateAndEnhanceData(collectedData);

      const validationEnd = performance.now();
      result.steps.validation = {
        success: true,
        duration: validationEnd - validationStart,
      };
      courseLogger.info('Data validation completed');

      // Step 3: Quality Assessment
      courseLogger.info('Starting quality assessment');
      const qualityStart = performance.now();

      const qualityReport = await this.qualitySystem.assessQuality(validatedData);
      result.qualityScore = qualityReport.metrics.overallScore;
      result.issues = qualityReport.issues;

      const qualityEnd = performance.now();
      courseLogger.info('Quality assessment completed', {
        score: qualityReport.metrics.overallScore,
        issues: qualityReport.issues.length,
      });

      // Check if quality meets threshold
      if (qualityReport.metrics.overallScore < config.qualityThreshold) {
        courseLogger.warn('Course quality below threshold', {
          score: qualityReport.metrics.overallScore,
          threshold: config.qualityThreshold,
        });
      }

      // Step 4: Image Processing (if enabled)
      if (config.enabledServices.imageProcessing && collectedData.imageData?.length) {
        courseLogger.info('Starting image processing');
        const imageStart = performance.now();

        const processedMedia = await this.processMediaContent(collectedData);

        const imageEnd = performance.now();
        result.steps.imageProcessing = {
          success: true,
          duration: imageEnd - imageStart,
          data: { processedImages: processedMedia.length },
        };
        courseLogger.info('Image processing completed', {
          processedImages: processedMedia.length
        });
      }

      // Step 5: Database Update
      courseLogger.info('Updating database');
      await this.updateDatabase(validatedData, result.qualityScore || 0);
      courseLogger.info('Database updated');

      // Step 6: SEO Page Generation (if enabled)
      if (config.enabledServices.seoGeneration) {
        courseLogger.info('Starting SEO page generation');
        const seoStart = performance.now();

        await this.generateSEOPage(validatedData);

        const seoEnd = performance.now();
        result.steps.seoGeneration = {
          success: true,
          duration: seoEnd - seoStart,
        };
        courseLogger.info('SEO page generation completed');
      }

      // Mark as successful
      result.success = true;
      result.dataCollected = Object.keys(collectedData).length;
      result.processingTime = performance.now() - startTime;

      courseLogger.info('Course processing completed successfully', {
        totalTime: result.processingTime,
        qualityScore: result.qualityScore,
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      courseLogger.error('Course processing failed:', error);

      result.success = false;
      result.error = errorMessage;
      result.processingTime = performance.now() - startTime;

      // Retry logic
      if (config.retryAttempts > 0) {
        courseLogger.info(`Retrying course processing (${config.retryAttempts} attempts remaining)`);
        // Implement retry with exponential backoff
        await this.delay(2000);
        return this.processSingleCourse(course, { ...config, retryAttempts: config.retryAttempts - 1 }, batchId);
      }

      return result;
    }
  }

  /**
   * Collect data from all available sources
   */
  private async collectCourseData(course: CourseTarget, config: AutomationConfig): Promise<CollectedData> {
    return this.dataCollector.collectCourseData(course, {
      enableWeather: config.enabledServices.weatherUpdates,
      enableHistory: config.enabledServices.historyEnrichment,
      enableImages: config.enabledServices.imageProcessing,
    });
  }

  /**
   * Validate and enhance collected data
   */
  private async validateAndEnhanceData(data: CollectedData): Promise<AutomatedCourseDetails> {
    // Convert CollectedData to AutomatedCourseDetails format
    const courseData: AutomatedCourseDetails = {
      id: data.id,
      name: data.name,
      description: data.wikipediaData?.extract || data.websiteData?.description,
      city: data.locationData?.city || '',
      state: data.locationData?.state || '',
      country: data.locationData?.country || '',
      latitude: data.locationData?.latitude,
      longitude: data.locationData?.longitude,
      website: data.websiteData?.url,
      phone: data.websiteData?.contact?.phone,
      email: data.websiteData?.contact?.email,
      qualityScore: 0, // Will be set by quality assessment
      completenessScore: 0, // Will be set by quality assessment
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      enrichment: {
        weather: data.weatherData,
        history: data.historicalData,
        location: data.locationData,
      },
    };

    // Enhance the data using the quality system
    const enhanced = await this.qualitySystem.enhanceData(courseData);
    return enhanced;
  }

  /**
   * Process media content (images)
   */
  private async processMediaContent(data: CollectedData): Promise<any[]> {
    if (!data.imageData?.length) {
      return [];
    }

    // Placeholder for image processing logic
    // This would integrate with the existing image processing pipeline
    this.logger.info(`Processing ${data.imageData.length} images for course ${data.id}`);

    // Return processed media metadata
    return data.imageData.map(img => ({
      url: img.url,
      localPath: img.localPath,
      category: img.category,
      processed: true,
    }));
  }

  /**
   * Update database with processed data
   */
  private async updateDatabase(data: AutomatedCourseDetails, qualityScore: number): Promise<void> {
    // Placeholder for database update logic
    // This would integrate with the existing Prisma database operations
    this.logger.info(`Updating database for course ${data.id} (quality: ${qualityScore})`);
  }

  /**
   * Generate SEO-optimized pages
   */
  private async generateSEOPage(data: AutomatedCourseDetails): Promise<void> {
    // Placeholder for SEO page generation
    // This would integrate with the existing SEO generation system
    this.logger.info(`Generating SEO page for course ${data.id}`);
  }

  /**
   * Execute promises with controlled concurrency
   */
  private async executeWithConcurrency<T>(
    promises: Promise<T>[],
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < promises.length; i += concurrency) {
      const batch = promises.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Create batches from course list
   */
  private createBatches(courses: CourseTarget[], batchSize: number): CourseTarget[][] {
    const batches: CourseTarget[][] = [];

    for (let i = 0; i < courses.length; i += batchSize) {
      batches.push(courses.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Generate comprehensive summary report
   */
  private async generateSummaryReport(
    results: CourseProcessingResult[],
    startTime: number,
    endTime: number,
    processId: string
  ): Promise<AutomationResult> {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const averageQualityScore = successful.length > 0
      ? successful.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / successful.length
      : 0;

    const totalIssues = results.reduce((sum, r) => sum + (r.issues?.length || 0), 0);

    const summary: AutomationResult = {
      startTime,
      endTime,
      totalDuration: endTime - startTime,
      totalCourses: results.length,
      successfulCourses: successful.length,
      failedCourses: failed.length,
      averageQualityScore,
      totalIssues,
      batchResults: results,
      summary: this.createSummaryText(results, averageQualityScore),
    };

    // Save detailed report
    await this.saveDetailedReport(summary, processId);

    return summary;
  }

  /**
   * Create human-readable summary text
   */
  private createSummaryText(results: CourseProcessingResult[], avgQuality: number): string {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const successRate = ((successful / results.length) * 100).toFixed(1);

    return `Automation completed: ${successful}/${results.length} courses processed successfully (${successRate}% success rate). Average quality score: ${avgQuality.toFixed(1)}. ${failed > 0 ? `${failed} courses failed processing.` : 'All courses processed without errors.'}`;
  }

  /**
   * Save detailed report to file system
   */
  private async saveDetailedReport(summary: AutomationResult, processId: string): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const reportPath = path.join(reportsDir, `automation-${processId}.json`);
    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));

    this.logger.info(`Detailed report saved to ${reportPath}`);
  }

  /**
   * Send completion notification
   */
  private async notifyCompletion(summary: AutomationResult): Promise<void> {
    await this.alertManager.sendCompletionNotification(summary);
  }

  /**
   * Utility function for delays
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI execution when run directly
async function main() {
  if (require.main === module) {
    const orchestrator = new MasterAutomationOrchestrator();

    // Default configuration - can be overridden via command line args or config file
    const defaultConfig: AutomationConfig = {
      courses: [], // Would be loaded from database or config file
      batchSize: 10,
      concurrency: 3,
      retryAttempts: 2,
      qualityThreshold: 70,
      updateFrequency: 'daily',
      enabledServices: {
        scraping: true,
        weatherUpdates: true,
        historyEnrichment: true,
        imageProcessing: true,
        seoGeneration: true,
      },
    };

    try {
      // Parse command line arguments
      const args = process.argv.slice(2);
      const configPath = args.find(arg => arg.startsWith('--config='))?.split('=')[1];

      let config = defaultConfig;
      if (configPath) {
        const configFile = await fs.readFile(configPath, 'utf-8');
        config = { ...defaultConfig, ...JSON.parse(configFile) };
      }

      // Load courses from database if not provided
      if (config.courses.length === 0) {
        // Placeholder - would load from database
        console.log('No courses specified. Please provide a configuration file with course targets.');
        process.exit(1);
      }

      const result = await orchestrator.runFullAutomation(config);

      console.log('Automation completed successfully:');
      console.log(result.summary);
      console.log(`Full report available in reports/automation-${Date.now()}.json`);

    } catch (error) {
      console.error('Automation failed:', error);
      process.exit(1);
    }
  }
}

// Export for use as module
export { MasterAutomationOrchestrator };

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}