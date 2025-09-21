import * as cron from 'node-cron';
import * as schedule from 'node-schedule';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import * as path from 'path';

import { apiLogger } from '../utils/logger';
import { AlertManager } from './alert-manager';
import { HealthMonitor } from './health-monitor';

import type {
  ScheduledTask,
  ScheduleConfig,
  TaskExecution,
  AutomationEvent,
} from '../types/automation.types';

/**
 * Task execution result
 */
interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

/**
 * Schedule Manager
 *
 * Manages scheduled automation tasks using cron expressions.
 * Supports task execution monitoring, retry logic, and failure handling.
 */
export class ScheduleManager extends EventEmitter {
  private readonly logger = apiLogger.child({ service: 'schedule-manager' });
  private readonly alertManager: AlertManager;
  private readonly healthMonitor: HealthMonitor;
  private readonly scheduledJobs = new Map<string, any>();
  private readonly runningTasks = new Map<string, TaskExecution>();
  private readonly taskHistory = new Map<string, TaskExecution[]>();
  private config: ScheduleConfig;
  private isInitialized = false;

  constructor(config: ScheduleConfig) {
    super();
    this.config = config;
    this.alertManager = new AlertManager();
    this.healthMonitor = new HealthMonitor();

    this.logger.info('Schedule Manager initialized', {
      timezone: config.timezone,
      dailyTasks: config.dailyTasks.length,
      weeklyTasks: config.weeklyTasks.length,
      monthlyTasks: config.monthlyTasks.length,
    });
  }

  /**
   * Initialize and start all scheduled tasks
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Schedule Manager already initialized');
      return;
    }

    this.logger.info('Initializing scheduled tasks');

    try {
      // Setup timezone if specified
      if (this.config.timezone) {
        process.env.TZ = this.config.timezone;
      }

      // Setup all task categories
      await this.setupDailyTasks();
      await this.setupWeeklyTasks();
      await this.setupMonthlyTasks();

      // Load any persisted task state
      await this.loadTaskState();

      this.isInitialized = true;
      this.logger.info('Schedule Manager initialization completed', {
        activeJobs: this.scheduledJobs.size,
      });

    } catch (error) {
      this.logger.error('Failed to initialize Schedule Manager:', error);
      throw error;
    }
  }

  /**
   * Shutdown the schedule manager and cancel all jobs
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Schedule Manager');

    // Cancel all scheduled jobs
    for (const [taskId, job] of this.scheduledJobs) {
      try {
        if (job.cancel) {
          job.cancel();
        } else if (job.destroy) {
          job.destroy();
        }
        this.logger.info(`Cancelled scheduled job: ${taskId}`);
      } catch (error) {
        this.logger.warn(`Failed to cancel job ${taskId}:`, error);
      }
    }

    // Wait for running tasks to complete or timeout
    await this.waitForRunningTasks(30000); // 30 second timeout

    // Save current state
    await this.saveTaskState();

    this.scheduledJobs.clear();
    this.isInitialized = false;

    this.logger.info('Schedule Manager shutdown completed');
  }

  /**
   * Setup daily tasks (2 AM by default)
   */
  private async setupDailyTasks(): Promise<void> {
    const defaultDailyTasks: ScheduledTask[] = [
      {
        id: 'weather-update',
        name: 'Weather Data Update',
        script: 'update-weather-data.ts',
        args: ['--all-courses'],
        priority: 'high',
        maxDuration: 300000, // 5 minutes
        retryOnFailure: true,
        schedule: '0 2 * * *', // 2 AM daily
        enabled: true,
        status: 'pending',
      },
      {
        id: 'broken-links-check',
        name: 'Broken Links Check',
        script: 'validate-links.ts',
        args: ['--check-websites'],
        priority: 'medium',
        maxDuration: 600000, // 10 minutes
        retryOnFailure: false,
        schedule: '30 2 * * *', // 2:30 AM daily
        enabled: true,
        status: 'pending',
      },
      {
        id: 'image-optimization',
        name: 'Image Optimization',
        script: 'optimize-images.ts',
        args: ['--new-images-only'],
        priority: 'low',
        maxDuration: 1800000, // 30 minutes
        retryOnFailure: true,
        schedule: '0 3 * * *', // 3 AM daily
        enabled: true,
        status: 'pending',
      },
    ];

    const dailyTasks = this.config.dailyTasks.length > 0 ? this.config.dailyTasks : defaultDailyTasks;

    for (const task of dailyTasks) {
      if (task.enabled) {
        await this.scheduleTask(task);
      }
    }

    this.logger.info(`Setup ${dailyTasks.filter(t => t.enabled).length} daily tasks`);
  }

  /**
   * Setup weekly tasks (Sunday 3 AM by default)
   */
  private async setupWeeklyTasks(): Promise<void> {
    const defaultWeeklyTasks: ScheduledTask[] = [
      {
        id: 'full-data-validation',
        name: 'Full Data Validation',
        script: 'validate-all-data.ts',
        args: ['--comprehensive'],
        priority: 'high',
        maxDuration: 3600000, // 1 hour
        retryOnFailure: true,
        schedule: '0 3 * * 0', // 3 AM on Sunday
        enabled: true,
        status: 'pending',
      },
      {
        id: 'content-enhancement',
        name: 'Content Enhancement',
        script: 'enhance-content.ts',
        args: ['--low-quality-courses'],
        priority: 'medium',
        maxDuration: 1800000, // 30 minutes
        retryOnFailure: true,
        schedule: '0 4 * * 0', // 4 AM on Sunday
        enabled: true,
        status: 'pending',
      },
      {
        id: 'seo-analysis',
        name: 'SEO Performance Analysis',
        script: 'analyze-seo-performance.ts',
        args: ['--generate-report'],
        priority: 'medium',
        maxDuration: 900000, // 15 minutes
        retryOnFailure: false,
        schedule: '0 5 * * 0', // 5 AM on Sunday
        enabled: true,
        status: 'pending',
      },
    ];

    const weeklyTasks = this.config.weeklyTasks.length > 0 ? this.config.weeklyTasks : defaultWeeklyTasks;

    for (const task of weeklyTasks) {
      if (task.enabled) {
        await this.scheduleTask(task);
      }
    }

    this.logger.info(`Setup ${weeklyTasks.filter(t => t.enabled).length} weekly tasks`);
  }

  /**
   * Setup monthly tasks (1st of month 4 AM by default)
   */
  private async setupMonthlyTasks(): Promise<void> {
    const defaultMonthlyTasks: ScheduledTask[] = [
      {
        id: 'complete-data-refresh',
        name: 'Complete Data Refresh',
        script: 'master-automation.ts',
        args: ['--config=configs/monthly-refresh.json'],
        priority: 'high',
        maxDuration: 7200000, // 2 hours
        retryOnFailure: true,
        schedule: '0 4 1 * *', // 4 AM on 1st of month
        enabled: true,
        status: 'pending',
      },
      {
        id: 'database-maintenance',
        name: 'Database Maintenance',
        script: 'database-maintenance.ts',
        args: ['--full-maintenance'],
        priority: 'high',
        maxDuration: 1800000, // 30 minutes
        retryOnFailure: true,
        schedule: '0 6 1 * *', // 6 AM on 1st of month
        enabled: true,
        status: 'pending',
      },
      {
        id: 'performance-report',
        name: 'Monthly Performance Report',
        script: 'generate-performance-report.ts',
        args: ['--month-summary'],
        priority: 'low',
        maxDuration: 600000, // 10 minutes
        retryOnFailure: false,
        schedule: '0 7 1 * *', // 7 AM on 1st of month
        enabled: true,
        status: 'pending',
      },
    ];

    const monthlyTasks = this.config.monthlyTasks.length > 0 ? this.config.monthlyTasks : defaultMonthlyTasks;

    for (const task of monthlyTasks) {
      if (task.enabled) {
        await this.scheduleTask(task);
      }
    }

    this.logger.info(`Setup ${monthlyTasks.filter(t => t.enabled).length} monthly tasks`);
  }

  /**
   * Schedule a single task
   */
  private async scheduleTask(task: ScheduledTask): Promise<void> {
    try {
      // Validate cron expression
      if (!cron.validate(task.schedule)) {
        throw new Error(`Invalid cron expression: ${task.schedule}`);
      }

      // Create the scheduled job
      const job = cron.schedule(task.schedule, async () => {
        await this.executeTask(task);
      }, {
        scheduled: false, // Don't start immediately
        timezone: this.config.timezone,
      });

      // Store the job reference
      this.scheduledJobs.set(task.id, job);

      // Calculate next run time
      task.nextRun = this.getNextRunTime(task.schedule);

      // Start the job
      job.start();

      this.logger.info(`Scheduled task: ${task.name}`, {
        taskId: task.id,
        schedule: task.schedule,
        nextRun: task.nextRun?.toISOString(),
        priority: task.priority,
      });

    } catch (error) {
      this.logger.error(`Failed to schedule task ${task.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    const execution: TaskExecution = {
      taskId: task.id,
      startTime: new Date(),
      status: 'running',
      retryCount: 0,
    };

    const taskLogger = this.logger.child({
      taskId: task.id,
      taskName: task.name,
      executionId: `${task.id}-${execution.startTime.getTime()}`,
    });

    taskLogger.info('Starting scheduled task execution');

    // Check if task is already running
    if (this.runningTasks.has(task.id)) {
      taskLogger.warn('Task is already running, skipping execution');
      return;
    }

    // Add to running tasks
    this.runningTasks.set(task.id, execution);

    try {
      // Update task status
      task.status = 'running';
      task.lastRun = execution.startTime;

      // Execute the task with timeout
      const result = await this.executeTaskWithTimeout(task, taskLogger);

      // Update execution result
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.status = result.success ? 'success' : 'failed';
      execution.output = result.output;
      execution.error = result.error;

      // Update task status
      task.status = execution.status;
      task.nextRun = this.getNextRunTime(task.schedule);

      // Log completion
      if (result.success) {
        taskLogger.info('Task execution completed successfully', {
          duration: execution.duration,
          nextRun: task.nextRun?.toISOString(),
        });
      } else {
        taskLogger.error('Task execution failed', {
          error: result.error,
          duration: execution.duration,
        });

        // Handle retry logic
        if (task.retryOnFailure && execution.retryCount < 3) {
          taskLogger.info('Retrying failed task');
          await this.retryTask(task, execution);
          return;
        }

        // Send failure alert
        await this.alertManager.sendTaskFailureAlert(task, execution);
      }

      // Emit event
      this.emit('taskCompleted', {
        id: `task-${task.id}-${Date.now()}`,
        type: result.success ? 'task_completed' : 'task_failed',
        entityId: task.id,
        entityType: 'task',
        timestamp: new Date(),
        data: execution,
      } as AutomationEvent);

    } catch (error) {
      taskLogger.error('Task execution error:', error);

      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      task.status = 'failed';

      // Send alert for unexpected errors
      await this.alertManager.sendTaskFailureAlert(task, execution);

    } finally {
      // Remove from running tasks
      this.runningTasks.delete(task.id);

      // Add to history
      this.addToTaskHistory(task.id, execution);

      // Record metrics
      await this.healthMonitor.recordTaskExecution(task, execution);
    }
  }

  /**
   * Execute task with timeout protection
   */
  private async executeTaskWithTimeout(
    task: ScheduledTask,
    logger: any
  ): Promise<TaskResult> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let timeoutHandle: NodeJS.Timeout;
      let completed = false;

      // Setup timeout
      timeoutHandle = setTimeout(() => {
        if (!completed) {
          completed = true;
          logger.warn('Task execution timed out', { maxDuration: task.maxDuration });
          resolve({
            success: false,
            error: `Task timed out after ${task.maxDuration}ms`,
            duration: performance.now() - startTime,
          });
        }
      }, task.maxDuration);

      // Execute the actual task
      this.runTaskScript(task, logger)
        .then((result) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutHandle);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutHandle);
            resolve({
              success: false,
              error: error.message,
              duration: performance.now() - startTime,
            });
          }
        });
    });
  }

  /**
   * Run the actual task script
   */
  private async runTaskScript(task: ScheduledTask, logger: any): Promise<TaskResult> {
    const { spawn } = require('child_process');
    const startTime = performance.now();

    return new Promise((resolve) => {
      const scriptPath = path.join(process.cwd(), 'dist', 'scripts', task.script);
      const args = task.args || [];

      logger.info('Executing task script', { scriptPath, args });

      const child = spawn('node', [scriptPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number) => {
        const duration = performance.now() - startTime;
        const success = code === 0;

        logger.info('Task script execution completed', {
          exitCode: code,
          duration,
          success,
        });

        resolve({
          success,
          output: stdout,
          error: success ? undefined : stderr || `Process exited with code ${code}`,
          duration,
        });
      });

      child.on('error', (error: Error) => {
        logger.error('Task script execution error:', error);
        resolve({
          success: false,
          error: error.message,
          duration: performance.now() - startTime,
        });
      });
    });
  }

  /**
   * Retry a failed task
   */
  private async retryTask(task: ScheduledTask, execution: TaskExecution): Promise<void> {
    execution.retryCount++;
    const delay = Math.pow(2, execution.retryCount) * 1000; // Exponential backoff

    this.logger.info(`Retrying task ${task.id} in ${delay}ms (attempt ${execution.retryCount})`);

    setTimeout(async () => {
      await this.executeTask(task);
    }, delay);
  }

  /**
   * Calculate next run time for a cron expression
   */
  private getNextRunTime(cronExpression: string): Date | undefined {
    try {
      // Use node-schedule to parse cron and get next occurrence
      const rule = new schedule.RecurrenceRule();
      // This is a simplified implementation
      // In practice, you'd use a proper cron parser
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Placeholder: next day
    } catch (error) {
      this.logger.warn('Failed to calculate next run time', { cronExpression, error });
      return undefined;
    }
  }

  /**
   * Add execution to task history
   */
  private addToTaskHistory(taskId: string, execution: TaskExecution): void {
    if (!this.taskHistory.has(taskId)) {
      this.taskHistory.set(taskId, []);
    }

    const history = this.taskHistory.get(taskId)!;
    history.push(execution);

    // Keep only last 50 executions per task
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  /**
   * Wait for all running tasks to complete
   */
  private async waitForRunningTasks(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (this.runningTasks.size > 0 && (Date.now() - startTime) < timeoutMs) {
      this.logger.info(`Waiting for ${this.runningTasks.size} tasks to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.runningTasks.size > 0) {
      this.logger.warn(`Timeout waiting for tasks: ${Array.from(this.runningTasks.keys()).join(', ')}`);
    }
  }

  /**
   * Load persisted task state
   */
  private async loadTaskState(): Promise<void> {
    try {
      const statePath = path.join(process.cwd(), 'data', 'task-state.json');
      const stateData = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(stateData);

      // Restore task history
      for (const [taskId, history] of Object.entries(state.taskHistory || {})) {
        this.taskHistory.set(taskId, history as TaskExecution[]);
      }

      this.logger.info('Task state loaded successfully');
    } catch (error) {
      // File might not exist on first run
      this.logger.info('No existing task state found, starting fresh');
    }
  }

  /**
   * Save current task state
   */
  private async saveTaskState(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });

      const state = {
        taskHistory: Object.fromEntries(this.taskHistory),
        lastSaved: new Date().toISOString(),
      };

      const statePath = path.join(dataDir, 'task-state.json');
      await fs.writeFile(statePath, JSON.stringify(state, null, 2));

      this.logger.info('Task state saved successfully');
    } catch (error) {
      this.logger.error('Failed to save task state:', error);
    }
  }

  /**
   * Get current status of all tasks
   */
  getTaskStatus(): {
    running: TaskExecution[];
    scheduled: ScheduledTask[];
    recentHistory: { [taskId: string]: TaskExecution[] };
  } {
    return {
      running: Array.from(this.runningTasks.values()),
      scheduled: [...this.config.dailyTasks, ...this.config.weeklyTasks, ...this.config.monthlyTasks],
      recentHistory: Object.fromEntries(
        Array.from(this.taskHistory.entries()).map(([taskId, history]) => [
          taskId,
          history.slice(-5), // Last 5 executions
        ])
      ),
    };
  }

  /**
   * Manually trigger a task
   */
  async triggerTask(taskId: string): Promise<void> {
    const allTasks = [...this.config.dailyTasks, ...this.config.weeklyTasks, ...this.config.monthlyTasks];
    const task = allTasks.find(t => t.id === taskId);

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    this.logger.info(`Manually triggering task: ${task.name}`);
    await this.executeTask(task);
  }

  /**
   * Update task configuration
   */
  async updateTaskConfig(taskId: string, updates: Partial<ScheduledTask>): Promise<void> {
    const allTasks = [...this.config.dailyTasks, ...this.config.weeklyTasks, ...this.config.monthlyTasks];
    const task = allTasks.find(t => t.id === taskId);

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Update task properties
    Object.assign(task, updates);

    // If schedule changed, reschedule the task
    if (updates.schedule || updates.enabled !== undefined) {
      const job = this.scheduledJobs.get(taskId);
      if (job) {
        job.destroy();
        this.scheduledJobs.delete(taskId);
      }

      if (task.enabled) {
        await this.scheduleTask(task);
      }
    }

    this.logger.info(`Task configuration updated: ${taskId}`, updates);
  }
}

export { ScheduleManager };