import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as client from 'prom-client';

import { apiLogger } from '../utils/logger';
import { AlertManager } from './alert-manager';

import type {
  HealthMetrics,
  SystemMetrics,
  DatabaseMetrics,
  AutomationMetrics,
  APIMetrics,
  StorageMetrics,
  Alert,
  ScheduledTask,
  TaskExecution,
  CourseProcessingResult,
  AutomationResult,
} from '../types/automation.types';

/**
 * Health check result
 */
interface HealthCheckResult {
  healthy: boolean;
  issues: string[];
  metrics: HealthMetrics;
  timestamp: Date;
}

/**
 * Threshold configuration for alerts
 */
interface HealthThresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  disk: { warning: number; critical: number };
  dbQueryTime: { warning: number; critical: number };
  dbErrorRate: { warning: number; critical: number };
  automationFailureRate: { warning: number; critical: number };
  apiResponseTime: { warning: number; critical: number };
}

/**
 * Health Monitor
 *
 * Monitors system health, database performance, automation metrics,
 * and API status. Generates alerts when thresholds are exceeded.
 */
export class HealthMonitor extends EventEmitter {
  private readonly logger = apiLogger.child({ service: 'health-monitor' });
  private readonly alertManager: AlertManager;
  private readonly metricsRegistry: client.Registry;
  private readonly thresholds: HealthThresholds;
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  // Prometheus metrics
  private readonly cpuGauge: client.Gauge<string>;
  private readonly memoryGauge: client.Gauge<string>;
  private readonly diskGauge: client.Gauge<string>;
  private readonly dbQueryTimeGauge: client.Gauge<string>;
  private readonly automationSuccessRate: client.Gauge<string>;
  private readonly apiResponseTimeGauge: client.Gauge<string>;
  private readonly taskExecutionCounter: client.Counter<string>;

  // Metrics storage
  private recentMetrics: HealthMetrics[] = [];
  private automationStats = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    totalBatches: 0,
    lastSuccessfulRun: null as Date | null,
  };

  constructor() {
    super();
    this.alertManager = new AlertManager();
    this.metricsRegistry = new client.Registry();

    // Default thresholds
    this.thresholds = {
      cpu: { warning: 80, critical: 90 },
      memory: { warning: 85, critical: 95 },
      disk: { warning: 85, critical: 95 },
      dbQueryTime: { warning: 1000, critical: 5000 },
      dbErrorRate: { warning: 0.05, critical: 0.20 },
      automationFailureRate: { warning: 0.10, critical: 0.25 },
      apiResponseTime: { warning: 2000, critical: 5000 },
    };

    // Initialize Prometheus metrics
    this.cpuGauge = new client.Gauge({
      name: 'system_cpu_usage_percent',
      help: 'Current CPU usage percentage',
      registers: [this.metricsRegistry],
    });

    this.memoryGauge = new client.Gauge({
      name: 'system_memory_usage_percent',
      help: 'Current memory usage percentage',
      registers: [this.metricsRegistry],
    });

    this.diskGauge = new client.Gauge({
      name: 'system_disk_usage_percent',
      help: 'Current disk usage percentage',
      registers: [this.metricsRegistry],
    });

    this.dbQueryTimeGauge = new client.Gauge({
      name: 'database_query_time_ms',
      help: 'Average database query time in milliseconds',
      registers: [this.metricsRegistry],
    });

    this.automationSuccessRate = new client.Gauge({
      name: 'automation_success_rate',
      help: 'Automation task success rate (0-1)',
      registers: [this.metricsRegistry],
    });

    this.apiResponseTimeGauge = new client.Gauge({
      name: 'api_response_time_ms',
      help: 'Average API response time in milliseconds',
      labelNames: ['api'],
      registers: [this.metricsRegistry],
    });

    this.taskExecutionCounter = new client.Counter({
      name: 'task_executions_total',
      help: 'Total number of task executions',
      labelNames: ['task_id', 'status'],
      registers: [this.metricsRegistry],
    });

    this.logger.info('Health Monitor initialized');
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(intervalMs = 60000): void {
    if (this.isMonitoring) {
      this.logger.warn('Health monitoring is already running');
      return;
    }

    this.logger.info('Starting health monitoring', { intervalMs });

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed:', error);
      }
    }, intervalMs);

    this.isMonitoring = true;
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    this.logger.info('Health monitoring stopped');
  }

  /**
   * Perform a comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      const metrics = await this.collectHealthMetrics();
      const issues = await this.checkHealthThresholds(metrics);
      const healthy = issues.length === 0;

      const result: HealthCheckResult = {
        healthy,
        issues,
        metrics,
        timestamp: new Date(),
      };

      // Store recent metrics (keep last 24 hours)
      this.recentMetrics.push(metrics);
      if (this.recentMetrics.length > 1440) { // 24 hours at 1-minute intervals
        this.recentMetrics.shift();
      }

      // Update Prometheus metrics
      this.updatePrometheusMetrics(metrics);

      // Emit health check event
      this.emit('healthCheck', result);

      // Log health status
      const duration = performance.now() - startTime;
      this.logger.info('Health check completed', {
        healthy,
        issuesCount: issues.length,
        duration: Math.round(duration),
        cpu: metrics.system.cpu,
        memory: metrics.system.memory,
        disk: metrics.system.disk,
      });

      return result;

    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Check if system health is good
   */
  async checkSystemHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    try {
      const result = await this.performHealthCheck();
      return {
        healthy: result.healthy,
        issues: result.issues,
      };
    } catch (error) {
      return {
        healthy: false,
        issues: [`Health check failed: ${error.message}`],
      };
    }
  }

  /**
   * Collect comprehensive health metrics
   */
  async collectHealthMetrics(): Promise<HealthMetrics> {
    const [system, database, automation, api, storage] = await Promise.all([
      this.getSystemMetrics(),
      this.getDatabaseMetrics(),
      this.getAutomationMetrics(),
      this.getAPIMetrics(),
      this.getStorageMetrics(),
    ]);

    return {
      system,
      database,
      automation,
      api,
      storage,
      timestamp: new Date(),
    };
  }

  /**
   * Get system metrics (CPU, memory, disk)
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    // CPU usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;

    // Disk usage (for current working directory)
    const diskUsage = await this.getDiskUsage();

    // Load average
    const loadAvg = os.loadavg();

    return {
      cpu: Math.round(usage * 100) / 100,
      memory: Math.round(memoryUsage * 100) / 100,
      disk: Math.round(diskUsage * 100) / 100,
      load: loadAvg,
      uptime: os.uptime(),
    };
  }

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    // Placeholder implementation
    // In a real implementation, this would query the database for:
    // - Connection pool stats
    // - Query performance
    // - Error rates
    // - Slow query logs

    return {
      connectionCount: 10, // Mock data
      activeConnections: 3,
      queryTime: 150,
      errorRate: 0.02,
      totalQueries: 1000,
      slowQueries: 5,
    };
  }

  /**
   * Get automation metrics
   */
  private async getAutomationMetrics(): Promise<AutomationMetrics> {
    const successRate = this.automationStats.totalTasks > 0
      ? this.automationStats.successfulTasks / this.automationStats.totalTasks
      : 1.0;

    const failureRate = 1 - successRate;

    return {
      tasksRunning: 0, // Would be tracked in real implementation
      tasksQueued: 0,
      tasksCompleted: this.automationStats.successfulTasks,
      lastSuccessfulRun: this.automationStats.lastSuccessfulRun,
      failureRate: Math.round(failureRate * 10000) / 10000,
      averageProcessingTime: 0, // Would be calculated from recent task executions
    };
  }

  /**
   * Get API metrics
   */
  private async getAPIMetrics(): Promise<APIMetrics> {
    // In real implementation, this would check API endpoints
    // For now, return mock data
    return {
      weatherApiStatus: 'up',
      wikipediaApiStatus: 'up',
      osmApiStatus: 'up',
      responseTime: 500,
      requestCount: 100,
      errorCount: 2,
      rateLimitHits: 0,
    };
  }

  /**
   * Get storage metrics
   */
  private async getStorageMetrics(): Promise<StorageMetrics> {
    try {
      const stats = await fs.stat(process.cwd());

      // Get directory sizes
      const mediaDir = path.join(process.cwd(), 'media');
      const logsDir = path.join(process.cwd(), 'logs');
      const dataDir = path.join(process.cwd(), 'data');

      const [mediaSize, logsSize, dataSize] = await Promise.all([
        this.getDirectorySize(mediaDir),
        this.getDirectorySize(logsDir),
        this.getDirectorySize(dataDir),
      ]);

      const totalSize = mediaSize + logsSize + dataSize;

      return {
        totalSize,
        usedSize: totalSize,
        availableSize: 0, // Would calculate from filesystem
        imageCount: await this.countFiles(mediaDir, ['.jpg', '.jpeg', '.png', '.webp']),
        tempFileCount: await this.countFiles(path.join(dataDir, 'temp')),
        logFileCount: await this.countFiles(logsDir, ['.log']),
      };

    } catch (error) {
      this.logger.warn('Failed to get storage metrics:', error);
      return {
        totalSize: 0,
        usedSize: 0,
        availableSize: 0,
        imageCount: 0,
        tempFileCount: 0,
        logFileCount: 0,
      };
    }
  }

  /**
   * Check health metrics against thresholds
   */
  private async checkHealthThresholds(metrics: HealthMetrics): Promise<string[]> {
    const issues: string[] = [];
    const alerts: Alert[] = [];

    // System health checks
    if (metrics.system.cpu > this.thresholds.cpu.critical) {
      const issue = `Critical CPU usage: ${metrics.system.cpu}%`;
      issues.push(issue);
      alerts.push({
        id: `cpu-critical-${Date.now()}`,
        level: 'critical',
        category: 'system',
        message: issue,
        timestamp: new Date(),
        acknowledged: false,
        metadata: { cpu: metrics.system.cpu },
      });
    } else if (metrics.system.cpu > this.thresholds.cpu.warning) {
      const issue = `High CPU usage: ${metrics.system.cpu}%`;
      issues.push(issue);
      alerts.push({
        id: `cpu-warning-${Date.now()}`,
        level: 'warning',
        category: 'system',
        message: issue,
        timestamp: new Date(),
        acknowledged: false,
        metadata: { cpu: metrics.system.cpu },
      });
    }

    if (metrics.system.memory > this.thresholds.memory.critical) {
      const issue = `Critical memory usage: ${metrics.system.memory}%`;
      issues.push(issue);
      alerts.push({
        id: `memory-critical-${Date.now()}`,
        level: 'critical',
        category: 'system',
        message: issue,
        timestamp: new Date(),
        acknowledged: false,
        metadata: { memory: metrics.system.memory },
      });
    } else if (metrics.system.memory > this.thresholds.memory.warning) {
      const issue = `High memory usage: ${metrics.system.memory}%`;
      issues.push(issue);
      alerts.push({
        id: `memory-warning-${Date.now()}`,
        level: 'warning',
        category: 'system',
        message: issue,
        timestamp: new Date(),
        acknowledged: false,
        metadata: { memory: metrics.system.memory },
      });
    }

    if (metrics.system.disk > this.thresholds.disk.critical) {
      const issue = `Critical disk usage: ${metrics.system.disk}%`;
      issues.push(issue);
      alerts.push({
        id: `disk-critical-${Date.now()}`,
        level: 'critical',
        category: 'system',
        message: issue,
        timestamp: new Date(),
        acknowledged: false,
        metadata: { disk: metrics.system.disk },
      });
    }

    // Database health checks
    if (metrics.database.queryTime > this.thresholds.dbQueryTime.critical) {
      const issue = `Critical database query time: ${metrics.database.queryTime}ms`;
      issues.push(issue);
      alerts.push({
        id: `db-query-critical-${Date.now()}`,
        level: 'critical',
        category: 'database',
        message: issue,
        timestamp: new Date(),
        acknowledged: false,
        metadata: { queryTime: metrics.database.queryTime },
      });
    }

    if (metrics.database.errorRate > this.thresholds.dbErrorRate.critical) {
      const issue = `Critical database error rate: ${(metrics.database.errorRate * 100).toFixed(1)}%`;
      issues.push(issue);
      alerts.push({
        id: `db-error-critical-${Date.now()}`,
        level: 'critical',
        category: 'database',
        message: issue,
        timestamp: new Date(),
        acknowledged: false,
        metadata: { errorRate: metrics.database.errorRate },
      });
    }

    // Automation health checks
    if (metrics.automation.failureRate > this.thresholds.automationFailureRate.critical) {
      const issue = `Critical automation failure rate: ${(metrics.automation.failureRate * 100).toFixed(1)}%`;
      issues.push(issue);
      alerts.push({
        id: `automation-failure-critical-${Date.now()}`,
        level: 'critical',
        category: 'automation',
        message: issue,
        timestamp: new Date(),
        acknowledged: false,
        metadata: { failureRate: metrics.automation.failureRate },
      });
    }

    // API health checks
    if (metrics.api.responseTime > this.thresholds.apiResponseTime.critical) {
      const issue = `Critical API response time: ${metrics.api.responseTime}ms`;
      issues.push(issue);
      alerts.push({
        id: `api-response-critical-${Date.now()}`,
        level: 'critical',
        category: 'api',
        message: issue,
        timestamp: new Date(),
        acknowledged: false,
        metadata: { responseTime: metrics.api.responseTime },
      });
    }

    // Send alerts if any issues found
    if (alerts.length > 0) {
      await this.alertManager.sendAlerts(alerts);
    }

    return issues;
  }

  /**
   * Update Prometheus metrics
   */
  private updatePrometheusMetrics(metrics: HealthMetrics): void {
    this.cpuGauge.set(metrics.system.cpu);
    this.memoryGauge.set(metrics.system.memory);
    this.diskGauge.set(metrics.system.disk);
    this.dbQueryTimeGauge.set(metrics.database.queryTime);
    this.automationSuccessRate.set(1 - metrics.automation.failureRate);
    this.apiResponseTimeGauge.set({ api: 'weather' }, metrics.api.responseTime);
  }

  /**
   * Record task execution metrics
   */
  async recordTaskExecution(task: ScheduledTask, execution: TaskExecution): Promise<void> {
    // Update automation stats
    this.automationStats.totalTasks++;
    if (execution.status === 'success') {
      this.automationStats.successfulTasks++;
      this.automationStats.lastSuccessfulRun = execution.endTime || new Date();
    } else {
      this.automationStats.failedTasks++;
    }

    // Update Prometheus counter
    this.taskExecutionCounter.inc({
      task_id: task.id,
      status: execution.status,
    });

    this.logger.info('Task execution recorded', {
      taskId: task.id,
      status: execution.status,
      duration: execution.duration,
      totalTasks: this.automationStats.totalTasks,
      successRate: this.automationStats.successfulTasks / this.automationStats.totalTasks,
    });
  }

  /**
   * Record batch processing metrics
   */
  async recordBatchMetrics(batchId: string, results: CourseProcessingResult[]): Promise<void> {
    this.automationStats.totalBatches++;

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    this.logger.info('Batch metrics recorded', {
      batchId,
      totalCourses: results.length,
      successful,
      failed,
      successRate: successful / results.length,
    });
  }

  /**
   * Record automation completion
   */
  async recordAutomationCompletion(processId: string, summary: AutomationResult): Promise<void> {
    this.automationStats.lastSuccessfulRun = new Date(summary.endTime);

    this.logger.info('Automation completion recorded', {
      processId,
      totalCourses: summary.totalCourses,
      successful: summary.successfulCourses,
      failed: summary.failedCourses,
      duration: summary.totalDuration,
      averageQuality: summary.averageQualityScore,
    });
  }

  /**
   * Get disk usage percentage
   */
  private async getDiskUsage(): Promise<number> {
    try {
      // This is a simplified implementation
      // In production, you'd use statvfs or similar
      return 45; // Mock 45% usage
    } catch (error) {
      this.logger.warn('Failed to get disk usage:', error);
      return 0;
    }
  }

  /**
   * Get directory size in bytes
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return stats.size;
      }

      const files = await fs.readdir(dirPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileStats = await fs.stat(filePath);

        if (fileStats.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          totalSize += fileStats.size;
        }
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Count files in directory with optional extensions filter
   */
  private async countFiles(dirPath: string, extensions?: string[]): Promise<number> {
    try {
      const files = await fs.readdir(dirPath);

      if (!extensions) {
        return files.length;
      }

      return files.filter(file =>
        extensions.some(ext => file.toLowerCase().endsWith(ext.toLowerCase()))
      ).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get recent metrics for analysis
   */
  getRecentMetrics(hours = 1): HealthMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.recentMetrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  /**
   * Get Prometheus metrics
   */
  getPrometheusMetrics(): Promise<string> {
    return this.metricsRegistry.metrics();
  }

  /**
   * Update health thresholds
   */
  updateThresholds(newThresholds: Partial<HealthThresholds>): void {
    Object.assign(this.thresholds, newThresholds);
    this.logger.info('Health thresholds updated', newThresholds);
  }
}

export { HealthMonitor };