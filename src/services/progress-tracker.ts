import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

import { apiLogger } from '../utils/logger';

import type {
  ProgressReport,
  PerformanceMetrics,
  BatchProgress,
  CourseProcessingResult,
  QualityIssue,
} from '../types/automation.types';

/**
 * Progress update data
 */
interface ProgressUpdate {
  processId: string;
  batchId?: string;
  total: number;
  completed: number;
  successful: number;
  failed: number;
  currentCourse?: string;
  estimatedTimeRemaining?: number;
}

/**
 * Processing statistics
 */
interface ProcessingStats {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  startTime: Date;
  lastUpdate: Date;
}

/**
 * Quality statistics
 */
interface QualityStats {
  averageScore: number;
  totalAssessments: number;
  scoreDistribution: { [range: string]: number };
  commonIssues: { [type: string]: number };
}

/**
 * Performance tracking data
 */
interface PerformanceData {
  processingTimes: number[];
  qualityScores: number[];
  dataCompleteness: number[];
  imageSuccessRates: number[];
  apiSuccessRates: number[];
  scrapeSuccessRates: number[];
  enhancementSuccessRates: number[];
}

/**
 * Progress Tracker
 *
 * Tracks automation progress, generates reports, and provides
 * real-time status information for monitoring dashboards.
 */
export class ProgressTracker extends EventEmitter {
  private readonly logger = apiLogger.child({ service: 'progress-tracker' });
  private activeRuns = new Map<string, ProcessingStats>();
  private activeBatches = new Map<string, BatchProgress>();
  private completedRuns: ProcessingStats[] = [];
  private recentResults: CourseProcessingResult[] = [];
  private performanceData: PerformanceData = {
    processingTimes: [],
    qualityScores: [],
    dataCompleteness: [],
    imageSuccessRates: [],
    apiSuccessRates: [],
    scrapeSuccessRates: [],
    enhancementSuccessRates: [],
  };

  constructor() {
    super();
    this.logger.info('Progress Tracker initialized');
  }

  /**
   * Initialize a new automation run
   */
  async initializeRun(processId: string, totalCourses: number): Promise<void> {
    const stats: ProcessingStats = {
      total: totalCourses,
      processed: 0,
      successful: 0,
      failed: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
    };

    this.activeRuns.set(processId, stats);

    this.logger.info('Automation run initialized', {
      processId,
      totalCourses,
    });

    this.emit('runStarted', {
      processId,
      totalCourses,
      startTime: stats.startTime,
    });
  }

  /**
   * Update progress for an automation run
   */
  async updateProgress(update: ProgressUpdate): Promise<void> {
    const stats = this.activeRuns.get(update.processId);
    if (!stats) {
      this.logger.warn('Progress update for unknown process', { processId: update.processId });
      return;
    }

    // Update statistics
    stats.processed = update.completed;
    stats.successful = update.successful;
    stats.failed = update.failed;
    stats.lastUpdate = new Date();

    // Update batch progress if provided
    if (update.batchId) {
      const batchProgress: BatchProgress = {
        batchId: update.batchId,
        startTime: this.activeBatches.get(update.batchId)?.startTime || new Date(),
        totalCourses: update.total,
        completedCourses: update.completed,
        currentCourse: update.currentCourse,
        estimatedTimeRemaining: update.estimatedTimeRemaining,
        errors: [],
      };

      this.activeBatches.set(update.batchId, batchProgress);
    }

    // Calculate progress percentage
    const progressPercent = Math.round((update.completed / update.total) * 100);

    this.logger.info('Progress updated', {
      processId: update.processId,
      batchId: update.batchId,
      progress: `${update.completed}/${update.total} (${progressPercent}%)`,
      successful: update.successful,
      failed: update.failed,
    });

    // Emit progress event
    this.emit('progressUpdated', {
      processId: update.processId,
      batchId: update.batchId,
      total: update.total,
      completed: update.completed,
      successful: update.successful,
      failed: update.failed,
      progressPercent,
      currentCourse: update.currentCourse,
    });

    // Auto-save progress snapshots periodically
    if (update.completed % 10 === 0) { // Every 10 courses
      await this.saveProgressSnapshot(update.processId);
    }
  }

  /**
   * Complete an automation run
   */
  async completeRun(processId: string): Promise<void> {
    const stats = this.activeRuns.get(processId);
    if (!stats) {
      this.logger.warn('Completing unknown process', { processId });
      return;
    }

    // Move to completed runs
    this.completedRuns.push(stats);
    this.activeRuns.delete(processId);

    // Clean up batch progress
    for (const [batchId, batch] of this.activeBatches) {
      if (batchId.startsWith(processId)) {
        this.activeBatches.delete(batchId);
      }
    }

    // Keep only last 50 completed runs
    if (this.completedRuns.length > 50) {
      this.completedRuns = this.completedRuns.slice(-50);
    }

    const duration = Date.now() - stats.startTime.getTime();
    const successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

    this.logger.info('Automation run completed', {
      processId,
      total: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      successRate: `${successRate.toFixed(1)}%`,
      duration: `${Math.round(duration / 1000 / 60)} minutes`,
    });

    this.emit('runCompleted', {
      processId,
      stats,
      duration,
      successRate,
    });
  }

  /**
   * Record course processing results
   */
  async recordResults(results: CourseProcessingResult[]): Promise<void> {
    this.recentResults.push(...results);

    // Keep only last 1000 results
    if (this.recentResults.length > 1000) {
      this.recentResults = this.recentResults.slice(-1000);
    }

    // Update performance data
    for (const result of results) {
      if (result.success) {
        if (result.processingTime) {
          this.performanceData.processingTimes.push(result.processingTime);
        }
        if (result.qualityScore) {
          this.performanceData.qualityScores.push(result.qualityScore);
        }
      }
    }

    // Trim performance arrays to keep memory usage reasonable
    this.trimPerformanceArrays();

    this.logger.info('Course results recorded', {
      count: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });
  }

  /**
   * Generate comprehensive progress report
   */
  async generateProgressReport(): Promise<ProgressReport> {
    const processingStats = await this.getProcessingStats();
    const qualityStats = await this.getQualityStats();
    const performanceMetrics = await this.getPerformanceMetrics();
    const recentIssues = await this.getRecentIssues();

    const report: ProgressReport = {
      reportId: `report-${Date.now()}`,
      timestamp: new Date(),
      totalCourses: processingStats.total,
      processedCourses: processingStats.processed,
      successfulCourses: processingStats.successful,
      failedCourses: processingStats.failed,
      averageQualityScore: qualityStats.averageScore,
      estimatedCompletion: this.calculateETA(processingStats),
      recentIssues,
      performanceMetrics,
      currentBatch: this.getCurrentBatch(),
    };

    this.logger.info('Progress report generated', {
      reportId: report.reportId,
      processedCourses: report.processedCourses,
      successfulCourses: report.successfulCourses,
      averageQuality: report.averageQualityScore,
    });

    return report;
  }

  /**
   * Get current processing statistics
   */
  private async getProcessingStats(): Promise<ProcessingStats> {
    // Aggregate stats from active and completed runs
    let totalStats: ProcessingStats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
    };

    // Include active runs
    for (const stats of this.activeRuns.values()) {
      totalStats.total += stats.total;
      totalStats.processed += stats.processed;
      totalStats.successful += stats.successful;
      totalStats.failed += stats.failed;

      if (stats.startTime < totalStats.startTime) {
        totalStats.startTime = stats.startTime;
      }
      if (stats.lastUpdate > totalStats.lastUpdate) {
        totalStats.lastUpdate = stats.lastUpdate;
      }
    }

    // Include recent completed runs (last 24 hours)
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentCompleted = this.completedRuns.filter(run =>
      run.startTime.getTime() > dayAgo
    );

    for (const stats of recentCompleted) {
      totalStats.total += stats.total;
      totalStats.processed += stats.processed;
      totalStats.successful += stats.successful;
      totalStats.failed += stats.failed;
    }

    return totalStats;
  }

  /**
   * Get quality statistics
   */
  private async getQualityStats(): Promise<QualityStats> {
    const scores = this.performanceData.qualityScores;
    const averageScore = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;

    // Calculate score distribution
    const scoreDistribution: { [range: string]: number } = {
      '90-100': 0,
      '80-89': 0,
      '70-79': 0,
      '60-69': 0,
      '0-59': 0,
    };

    for (const score of scores) {
      if (score >= 90) scoreDistribution['90-100']++;
      else if (score >= 80) scoreDistribution['80-89']++;
      else if (score >= 70) scoreDistribution['70-79']++;
      else if (score >= 60) scoreDistribution['60-69']++;
      else scoreDistribution['0-59']++;
    }

    // Analyze common issues from recent results
    const commonIssues: { [type: string]: number } = {};
    for (const result of this.recentResults) {
      if (result.issues) {
        for (const issue of result.issues) {
          commonIssues[issue.type] = (commonIssues[issue.type] || 0) + 1;
        }
      }
    }

    return {
      averageScore,
      totalAssessments: scores.length,
      scoreDistribution,
      commonIssues,
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const { processingTimes, qualityScores } = this.performanceData;

    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    // Calculate data completeness from recent results
    const successfulResults = this.recentResults.filter(r => r.success);
    const dataCompleteness = successfulResults.length > 0
      ? successfulResults.reduce((sum, result) => {
          // Estimate completeness based on available data
          return sum + (result.dataCollected || 0) / 10; // Assuming 10 is max data fields
        }, 0) / successfulResults.length * 100
      : 0;

    // Image processing success rate
    const imageProcessingSuccess = this.calculateSuccessRate('imageProcessing');

    // API success rate
    const apiSuccessRate = this.calculateSuccessRate('dataCollection');

    // Scraping success rate
    const scrapeSuccessRate = this.calculateSuccessRate('dataCollection');

    // Enhancement success rate
    const enhancementSuccess = this.calculateSuccessRate('validation');

    return {
      avgProcessingTime: Math.round(avgProcessingTime),
      dataCompleteness: Math.round(dataCompleteness * 100) / 100,
      imageProcessingSuccess: Math.round(imageProcessingSuccess * 100) / 100,
      apiSuccessRate: Math.round(apiSuccessRate * 100) / 100,
      scrapeSuccessRate: Math.round(scrapeSuccessRate * 100) / 100,
      enhancementSuccess: Math.round(enhancementSuccess * 100) / 100,
    };
  }

  /**
   * Calculate success rate for a specific step
   */
  private calculateSuccessRate(stepName: string): number {
    const results = this.recentResults.slice(-100); // Last 100 results
    const withStep = results.filter(r => r.steps[stepName as keyof typeof r.steps]);

    if (withStep.length === 0) return 100;

    const successful = withStep.filter(r =>
      r.steps[stepName as keyof typeof r.steps]?.success
    ).length;

    return (successful / withStep.length) * 100;
  }

  /**
   * Get recent issues
   */
  private async getRecentIssues(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Collect issues from recent results
    for (const result of this.recentResults.slice(-50)) {
      if (result.issues) {
        issues.push(...result.issues);
      }
    }

    // Sort by severity and return top 20
    return issues
      .sort((a, b) => {
        const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        return (severityOrder[b.severity as keyof typeof severityOrder] || 0) -
               (severityOrder[a.severity as keyof typeof severityOrder] || 0);
      })
      .slice(0, 20);
  }

  /**
   * Calculate estimated time of completion
   */
  private calculateETA(stats: ProcessingStats): Date | undefined {
    if (stats.processed === 0 || stats.processed >= stats.total) {
      return undefined;
    }

    const elapsed = Date.now() - stats.startTime.getTime();
    const avgTimePerCourse = elapsed / stats.processed;
    const remaining = stats.total - stats.processed;
    const estimatedRemaining = remaining * avgTimePerCourse;

    return new Date(Date.now() + estimatedRemaining);
  }

  /**
   * Get current batch progress
   */
  private getCurrentBatch(): BatchProgress | undefined {
    // Return the most recently started batch
    let latestBatch: BatchProgress | undefined;
    let latestTime = 0;

    for (const batch of this.activeBatches.values()) {
      if (batch.startTime.getTime() > latestTime) {
        latestTime = batch.startTime.getTime();
        latestBatch = batch;
      }
    }

    return latestBatch;
  }

  /**
   * Trim performance arrays to manage memory
   */
  private trimPerformanceArrays(): void {
    const maxLength = 1000;

    for (const key in this.performanceData) {
      const array = this.performanceData[key as keyof PerformanceData] as number[];
      if (array.length > maxLength) {
        this.performanceData[key as keyof PerformanceData] = array.slice(-maxLength) as any;
      }
    }
  }

  /**
   * Save progress snapshot to file
   */
  async saveProgressSnapshot(processId?: string): Promise<void> {
    try {
      const report = await this.generateProgressReport();

      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });

      const filename = processId
        ? `progress-${processId}-${Date.now()}.json`
        : `progress-snapshot-${Date.now()}.json`;

      const reportPath = path.join(reportsDir, filename);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      this.logger.info('Progress snapshot saved', { reportPath });

    } catch (error) {
      this.logger.error('Failed to save progress snapshot:', error);
    }
  }

  /**
   * Load historical progress data
   */
  async loadHistoricalData(): Promise<void> {
    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      const files = await fs.readdir(reportsDir);
      const progressFiles = files.filter(f => f.startsWith('progress-') && f.endsWith('.json'));

      // Load the most recent progress files (last 10)
      const recentFiles = progressFiles.slice(-10);

      for (const file of recentFiles) {
        try {
          const filePath = path.join(reportsDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const report: ProgressReport = JSON.parse(data);

          // Extract performance data from historical reports
          if (report.performanceMetrics) {
            // Add to our performance tracking
            // This is a simplified implementation
          }

        } catch (error) {
          this.logger.warn(`Failed to load progress file ${file}:`, error);
        }
      }

      this.logger.info(`Loaded historical data from ${recentFiles.length} files`);

    } catch (error) {
      this.logger.warn('Failed to load historical progress data:', error);
    }
  }

  /**
   * Get current status summary
   */
  getCurrentStatus(): {
    activeRuns: number;
    activeBatches: number;
    totalProcessed: number;
    recentSuccessRate: number;
    avgQualityScore: number;
  } {
    const activeRuns = this.activeRuns.size;
    const activeBatches = this.activeBatches.size;

    let totalProcessed = 0;
    for (const stats of this.activeRuns.values()) {
      totalProcessed += stats.processed;
    }

    // Calculate recent success rate (last 100 results)
    const recentResults = this.recentResults.slice(-100);
    const recentSuccessRate = recentResults.length > 0
      ? (recentResults.filter(r => r.success).length / recentResults.length) * 100
      : 100;

    // Calculate average quality score
    const recentScores = this.performanceData.qualityScores.slice(-100);
    const avgQualityScore = recentScores.length > 0
      ? recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
      : 0;

    return {
      activeRuns,
      activeBatches,
      totalProcessed,
      recentSuccessRate: Math.round(recentSuccessRate * 100) / 100,
      avgQualityScore: Math.round(avgQualityScore * 100) / 100,
    };
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.activeRuns.clear();
    this.activeBatches.clear();
    this.completedRuns = [];
    this.recentResults = [];
    this.performanceData = {
      processingTimes: [],
      qualityScores: [],
      dataCompleteness: [],
      imageSuccessRates: [],
      apiSuccessRates: [],
      scrapeSuccessRates: [],
      enhancementSuccessRates: [],
    };

    this.logger.info('Progress tracker reset');
  }
}

export { ProgressTracker };