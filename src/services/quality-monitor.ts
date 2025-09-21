import type {
  QualityTrend,
  QualityReport,
  QualityCheckResult,
  QualityIssue,
  // AutomatedCourseDetails,
} from '../types/quality.types';
import { apiLogger } from '../utils/logger';

/**
 * Quality monitoring and trend tracking system
 */
export class QualityMonitor {
  private qualityHistory: QualityCheckResult[] = [];
  private trendCache: Map<string, QualityTrend[]> = new Map();

  /**
   * Record quality assessment result
   */
  recordQualityAssessment(result: QualityCheckResult): void {
    this.qualityHistory.push(result);

    // Limit history size to prevent memory issues
    if (this.qualityHistory.length > 10000) {
      this.qualityHistory = this.qualityHistory.slice(-5000);
    }

    // Clear trend cache to force recalculation
    this.trendCache.clear();

    apiLogger.info(`Quality assessment recorded for course ${result.courseId}`, {
      overallScore: result.metrics.overallScore,
      issuesCount: result.issues.length,
    });
  }

  /**
   * Generate comprehensive quality report
   */
  async generateQualityReport(timeframe: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<QualityReport> {
    const trends = await this.getQualityTrends(timeframe);
    const topIssues = await this.getTopQualityIssues();
    const sourceReliability = await this.analyzeSourceReliability();

    const summary = {
      totalCourses: await this.getTotalCourses(),
      averageQualityScore: this.calculateAverageScore(trends),
      coursesNeedingReview: await this.getCoursesNeedingReview(),
      recentlyUpdated: await this.getRecentlyUpdated(),
    };

    return {
      summary,
      trends,
      topIssues,
      sourceReliability,
      recommendations: this.generateRecommendations(trends, topIssues, summary),
    };
  }

  /**
   * Get quality trends over time
   */
  async getQualityTrends(timeframe: 'daily' | 'weekly' | 'monthly'): Promise<QualityTrend[]> {
    const cacheKey = `trends_${timeframe}`;

    if (this.trendCache.has(cacheKey)) {
      return this.trendCache.get(cacheKey)!;
    }

    const trends = this.calculateTrends(timeframe);
    this.trendCache.set(cacheKey, trends);

    return trends;
  }

  /**
   * Calculate quality trends
   */
  private calculateTrends(timeframe: 'daily' | 'weekly' | 'monthly'): QualityTrend[] {
    const trends: QualityTrend[] = [];

    // Determine time periods
    const periods = this.getTimePeriods(timeframe, 30); // Last 30 periods

    for (const period of periods) {
      const periodData = this.qualityHistory.filter(result => {
        const resultDate = new Date(result.lastValidated);
        return resultDate >= period.start && resultDate < period.end;
      });

      if (periodData.length === 0) {
        trends.push({
          date: period.start,
          overallScore: 0,
          completeness: 0,
          accuracy: 0,
          coursesValidated: 0,
          issuesFound: 0,
          issuesResolved: 0,
        });
        continue;
      }

      const avgOverallScore = periodData.reduce((sum, r) => sum + r.metrics.overallScore, 0) / periodData.length;
      const avgCompleteness = periodData.reduce((sum, r) => sum + r.metrics.completeness, 0) / periodData.length;
      const avgAccuracy = periodData.reduce((sum, r) => sum + r.metrics.accuracy, 0) / periodData.length;
      const totalIssues = periodData.reduce((sum, r) => sum + r.issues.length, 0);

      trends.push({
        date: period.start,
        overallScore: Math.round(avgOverallScore),
        completeness: Math.round(avgCompleteness),
        accuracy: Math.round(avgAccuracy),
        coursesValidated: periodData.length,
        issuesFound: totalIssues,
        issuesResolved: 0, // Would need to track resolution separately
      });
    }

    return trends.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get time periods for trend analysis
   */
  private getTimePeriods(timeframe: 'daily' | 'weekly' | 'monthly', count: number): Array<{ start: Date; end: Date }> {
    const periods: Array<{ start: Date; end: Date }> = [];
    const now = new Date();

    for (let i = count - 1; i >= 0; i--) {
      let start: Date;
      let end: Date;

      switch (timeframe) {
        case 'daily':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
          break;
        case 'weekly':
          const weekStart = new Date(now.getTime() - (i * 7 + now.getDay()) * 24 * 60 * 60 * 1000);
          start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
          end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          break;
      }

      periods.push({ start, end });
    }

    return periods;
  }

  /**
   * Get top quality issues across all courses
   */
  async getTopQualityIssues(limit: number = 10): Promise<QualityIssue[]> {
    const issueFrequency: Map<string, { issue: QualityIssue; count: number }> = new Map();

    // Aggregate issues by type and field
    for (const result of this.qualityHistory) {
      for (const issue of result.issues) {
        const key = `${issue.field}_${issue.type}_${issue.severity}`;

        if (issueFrequency.has(key)) {
          issueFrequency.get(key)!.count++;
        } else {
          issueFrequency.set(key, { issue: { ...issue }, count: 1 });
        }
      }
    }

    // Sort by frequency and return top issues
    return Array.from(issueFrequency.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(item => ({
        ...item.issue,
        message: `${item.issue.message} (affects ${item.count} courses)`,
      }));
  }

  /**
   * Analyze source reliability
   */
  async analyzeSourceReliability(): Promise<Record<string, number>> {
    const sourceStats: Map<string, { totalScore: number; count: number }> = new Map();

    // This would be enhanced to track actual data sources
    // For now, we'll simulate based on course source information
    const mockSources = ['official', 'pga', 'golflink', 'directory', 'community'];

    for (const source of mockSources) {
      const courseCount = Math.floor(Math.random() * 100) + 20;
      const avgReliability = Math.floor(Math.random() * 30) + 70; // 70-100 range

      sourceStats.set(source, {
        totalScore: avgReliability * courseCount,
        count: courseCount,
      });
    }

    const reliability: Record<string, number> = {};
    for (const [source, stats] of sourceStats) {
      reliability[source] = Math.round(stats.totalScore / stats.count);
    }

    return reliability;
  }

  /**
   * Get total number of courses assessed
   */
  async getTotalCourses(): Promise<number> {
    const uniqueCourses = new Set(this.qualityHistory.map(r => r.courseId));
    return uniqueCourses.size;
  }

  /**
   * Calculate average quality score from trends
   */
  private calculateAverageScore(trends: QualityTrend[]): number {
    if (trends.length === 0) return 0;

    const recentTrends = trends.slice(-7); // Last 7 periods
    const totalScore = recentTrends.reduce((sum, trend) => sum + trend.overallScore, 0);
    return Math.round(totalScore / recentTrends.length);
  }

  /**
   * Get count of courses needing manual review
   */
  async getCoursesNeedingReview(): Promise<number> {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentAssessments = this.qualityHistory.filter(r =>
      new Date(r.lastValidated) >= lastWeek
    );

    const coursesNeedingReview = new Set(
      recentAssessments
        .filter(r => r.manualReviewRequired)
        .map(r => r.courseId)
    );

    return coursesNeedingReview.size;
  }

  /**
   * Get count of recently updated courses
   */
  async getRecentlyUpdated(): Promise<number> {
    const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAssessments = this.qualityHistory.filter(r =>
      new Date(r.lastValidated) >= lastDay
    );

    const recentlyUpdated = new Set(recentAssessments.map(r => r.courseId));
    return recentlyUpdated.size;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    trends: QualityTrend[],
    topIssues: QualityIssue[],
    summary: any
  ): string[] {
    const recommendations: string[] = [];

    // Trend-based recommendations
    if (trends.length >= 2) {
      const latestTrend = trends[trends.length - 1];
      const previousTrend = trends[trends.length - 2];

      if (latestTrend.overallScore < previousTrend.overallScore) {
        const decline = previousTrend.overallScore - latestTrend.overallScore;
        recommendations.push(
          `Quality scores declined by ${decline} points. Review data collection processes.`
        );
      }

      if (latestTrend.coursesValidated < previousTrend.coursesValidated * 0.8) {
        recommendations.push(
          'Validation rate has decreased significantly. Check automation systems.'
        );
      }
    }

    // Issue-based recommendations
    const errorIssues = topIssues.filter(issue => issue.severity === 'error').length;
    const warningIssues = topIssues.filter(issue => issue.severity === 'warning').length;

    if (errorIssues > 3) {
      recommendations.push(
        `Address ${errorIssues} critical error types affecting multiple courses.`
      );
    }

    if (warningIssues > 5) {
      recommendations.push(
        `Review ${warningIssues} warning types to improve overall data quality.`
      );
    }

    // Summary-based recommendations
    if (summary.averageQualityScore < 75) {
      recommendations.push(
        'Overall quality score is below target (75). Prioritize data improvement initiatives.'
      );
    }

    if (summary.coursesNeedingReview > summary.totalCourses * 0.2) {
      recommendations.push(
        'High percentage of courses require manual review. Consider adjusting quality thresholds.'
      );
    }

    // Specific field recommendations based on top issues
    const fieldIssues = this.groupIssuesByField(topIssues);
    for (const [field, count] of Object.entries(fieldIssues)) {
      if (count > 10) {
        recommendations.push(`Focus on improving '${field}' data - affects ${count} courses.`);
      }
    }

    return recommendations.length > 0 ? recommendations : ['Quality metrics are within acceptable ranges.'];
  }

  /**
   * Group issues by field
   */
  private groupIssuesByField(issues: QualityIssue[]): Record<string, number> {
    const fieldCounts: Record<string, number> = {};

    for (const issue of issues) {
      fieldCounts[issue.field] = (fieldCounts[issue.field] || 0) + 1;
    }

    return fieldCounts;
  }

  /**
   * Get quality statistics for a specific course
   */
  getCourseQualityHistory(courseId: string): QualityCheckResult[] {
    return this.qualityHistory
      .filter(result => result.courseId === courseId)
      .sort((a, b) => new Date(b.lastValidated).getTime() - new Date(a.lastValidated).getTime());
  }

  /**
   * Get quality trend for a specific metric
   */
  getMetricTrend(metric: keyof QualityTrend, timeframe: 'daily' | 'weekly' | 'monthly' = 'weekly'): Array<{ date: Date; value: number }> {
    const trends = this.calculateTrends(timeframe);
    return trends.map(trend => ({
      date: trend.date,
      value: trend[metric] as number,
    }));
  }

  /**
   * Export quality data for external analysis
   */
  exportQualityData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        summary: this.qualityHistory.length,
        data: this.qualityHistory,
        exportedAt: new Date().toISOString(),
      }, null, 2);
    }

    // CSV format
    const headers = [
      'courseId', 'lastValidated', 'overallScore', 'completeness', 'accuracy',
      'consistency', 'reliability', 'freshness', 'issuesCount', 'manualReviewRequired'
    ];

    const rows = this.qualityHistory.map(result => [
      result.courseId,
      result.lastValidated.toISOString(),
      result.metrics.overallScore,
      result.metrics.completeness,
      result.metrics.accuracy,
      result.metrics.consistency,
      result.metrics.reliability,
      result.metrics.freshness,
      result.issues.length,
      result.manualReviewRequired,
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Clear quality history (for testing)
   */
  clearHistory(): void {
    this.qualityHistory = [];
    this.trendCache.clear();
  }

  /**
   * Get current quality statistics
   */
  getCurrentStats(): {
    totalAssessments: number;
    averageScore: number;
    coursesAssessed: number;
    recentActivity: number;
  } {
    const totalAssessments = this.qualityHistory.length;
    const uniqueCourses = new Set(this.qualityHistory.map(r => r.courseId)).size;

    const recentAssessments = this.qualityHistory.filter(r => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return new Date(r.lastValidated) >= dayAgo;
    });

    const avgScore = totalAssessments > 0
      ? this.qualityHistory.reduce((sum, r) => sum + r.metrics.overallScore, 0) / totalAssessments
      : 0;

    return {
      totalAssessments,
      averageScore: Math.round(avgScore),
      coursesAssessed: uniqueCourses,
      recentActivity: recentAssessments.length,
    };
  }
}

// Export singleton instance
export const qualityMonitor = new QualityMonitor();