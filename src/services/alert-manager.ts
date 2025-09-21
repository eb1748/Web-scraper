import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';

import { apiLogger } from '../utils/logger';

import type {
  Alert,
  Notification,
  NotificationConfig,
  ScheduledTask,
  TaskExecution,
  AutomationResult,
} from '../types/automation.types';

/**
 * Email template data
 */
interface EmailTemplateData {
  subject: string;
  title: string;
  content: string;
  priority: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Alert Manager
 *
 * Handles all notification and alerting functionality including:
 * - Email notifications
 * - Slack notifications
 * - Alert deduplication
 * - Notification queue management
 */
export class AlertManager {
  private readonly logger = apiLogger.child({ service: 'alert-manager' });
  private notificationConfig?: NotificationConfig;
  private emailTransporter?: nodemailer.Transporter;
  private pendingNotifications: Notification[] = [];
  private sentNotifications: Notification[] = [];
  private alertHistory: Alert[] = [];

  constructor(config?: NotificationConfig) {
    if (config) {
      this.updateConfig(config);
    }

    this.logger.info('Alert Manager initialized');
  }

  /**
   * Update notification configuration
   */
  async updateConfig(config: NotificationConfig): Promise<void> {
    this.notificationConfig = config;

    // Setup email transporter if email is enabled
    if (config.enabled && config.email) {
      try {
        this.emailTransporter = nodemailer.createTransporter({
          host: config.email.smtp.host,
          port: config.email.smtp.port,
          secure: config.email.smtp.secure,
          auth: {
            user: config.email.smtp.user,
            pass: config.email.smtp.password,
          },
        });

        // Verify email configuration
        await this.emailTransporter.verify();
        this.logger.info('Email transporter configured successfully');

      } catch (error) {
        this.logger.error('Failed to configure email transporter:', error);
        this.emailTransporter = undefined;
      }
    }

    this.logger.info('Alert Manager configuration updated', {
      enabled: config.enabled,
      hasEmail: !!config.email,
      hasSlack: !!config.slack,
    });
  }

  /**
   * Send multiple alerts
   */
  async sendAlerts(alerts: Alert[]): Promise<void> {
    if (!alerts.length) return;

    this.logger.info(`Processing ${alerts.length} alerts`);

    // Add to alert history
    this.alertHistory.push(...alerts);

    // Group alerts by priority and type for efficient notification
    const groupedAlerts = this.groupAlerts(alerts);

    for (const [key, alertGroup] of groupedAlerts) {
      try {
        await this.sendAlertGroup(alertGroup);
      } catch (error) {
        this.logger.error(`Failed to send alert group ${key}:`, error);
      }
    }

    // Clean up old alert history (keep last 1000)
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
  }

  /**
   * Send task failure alert
   */
  async sendTaskFailureAlert(task: ScheduledTask, execution: TaskExecution): Promise<void> {
    const alert: Alert = {
      id: `task-failure-${task.id}-${execution.startTime.getTime()}`,
      level: 'error',
      category: 'automation',
      message: `Task "${task.name}" failed: ${execution.error || 'Unknown error'}`,
      timestamp: new Date(),
      acknowledged: false,
      metadata: {
        taskId: task.id,
        taskName: task.name,
        duration: execution.duration,
        retryCount: execution.retryCount,
        error: execution.error,
      },
    };

    await this.sendAlerts([alert]);
  }

  /**
   * Send batch failure alert
   */
  async sendBatchFailureAlert(batchId: string, error: Error): Promise<void> {
    const alert: Alert = {
      id: `batch-failure-${batchId}-${Date.now()}`,
      level: 'critical',
      category: 'automation',
      message: `Batch processing failed: ${batchId}`,
      timestamp: new Date(),
      acknowledged: false,
      metadata: {
        batchId,
        error: error.message,
      },
    };

    await this.sendAlerts([alert]);
  }

  /**
   * Send automation failure alert
   */
  async sendAutomationFailureAlert(processId: string, error: Error): Promise<void> {
    const alert: Alert = {
      id: `automation-failure-${processId}-${Date.now()}`,
      level: 'critical',
      category: 'automation',
      message: `Complete automation workflow failed: ${processId}`,
      timestamp: new Date(),
      acknowledged: false,
      metadata: {
        processId,
        error: error.message,
      },
    };

    await this.sendAlerts([alert]);
  }

  /**
   * Send completion notification
   */
  async sendCompletionNotification(summary: AutomationResult): Promise<void> {
    const level = summary.failedCourses > 0 ? 'warning' : 'info';
    const successRate = (summary.successfulCourses / summary.totalCourses * 100).toFixed(1);

    const notification: Notification = {
      id: `completion-${Date.now()}`,
      type: 'email',
      title: 'Automation Workflow Completed',
      message: this.createCompletionMessage(summary),
      priority: level === 'warning' ? 'medium' : 'low',
      timestamp: new Date(),
      sent: false,
      metadata: {
        totalCourses: summary.totalCourses,
        successful: summary.successfulCourses,
        failed: summary.failedCourses,
        successRate,
        duration: summary.totalDuration,
        averageQuality: summary.averageQualityScore,
      },
    };

    await this.sendNotification(notification);
  }

  /**
   * Group alerts for efficient notification
   */
  private groupAlerts(alerts: Alert[]): Map<string, Alert[]> {
    const groups = new Map<string, Alert[]>();

    for (const alert of alerts) {
      // Group by category and level
      const key = `${alert.category}-${alert.level}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(alert);
    }

    return groups;
  }

  /**
   * Send a group of related alerts
   */
  private async sendAlertGroup(alerts: Alert[]): Promise<void> {
    if (!alerts.length) return;

    const firstAlert = alerts[0];
    const isHighPriority = firstAlert.level === 'critical' || firstAlert.level === 'error';

    // Create summary notification
    const notification: Notification = {
      id: `alert-group-${Date.now()}`,
      type: 'email',
      title: this.createAlertGroupTitle(alerts),
      message: this.createAlertGroupMessage(alerts),
      priority: isHighPriority ? 'high' : 'medium',
      timestamp: new Date(),
      sent: false,
      metadata: {
        alertCount: alerts.length,
        category: firstAlert.category,
        level: firstAlert.level,
        alerts: alerts.map(a => ({ id: a.id, message: a.message })),
      },
    };

    await this.sendNotification(notification);
  }

  /**
   * Send individual notification
   */
  private async sendNotification(notification: Notification): Promise<void> {
    if (!this.notificationConfig?.enabled) {
      this.logger.debug('Notifications disabled, skipping');
      return;
    }

    this.logger.info('Sending notification', {
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      title: notification.title,
    });

    try {
      switch (notification.type) {
        case 'email':
          await this.sendEmailNotification(notification);
          break;
        case 'slack':
          await this.sendSlackNotification(notification);
          break;
        default:
          this.logger.warn(`Unknown notification type: ${notification.type}`);
          return;
      }

      notification.sent = true;
      this.sentNotifications.push(notification);

      this.logger.info('Notification sent successfully', { id: notification.id });

    } catch (error) {
      notification.error = error instanceof Error ? error.message : 'Unknown error';
      this.pendingNotifications.push(notification);

      this.logger.error('Failed to send notification:', error, { id: notification.id });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: Notification): Promise<void> {
    if (!this.emailTransporter || !this.notificationConfig?.email) {
      throw new Error('Email not configured');
    }

    const templateData: EmailTemplateData = {
      subject: `[Golf Automation] ${notification.title}`,
      title: notification.title,
      content: notification.message,
      priority: notification.priority,
      timestamp: notification.timestamp.toISOString(),
      metadata: notification.metadata,
    };

    const htmlContent = await this.generateEmailHTML(templateData);
    const textContent = await this.generateEmailText(templateData);

    const mailOptions = {
      from: this.notificationConfig.email.from,
      to: this.notificationConfig.email.to,
      subject: templateData.subject,
      text: textContent,
      html: htmlContent,
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(notification: Notification): Promise<void> {
    if (!this.notificationConfig?.slack) {
      throw new Error('Slack not configured');
    }

    const color = this.getSlackColor(notification.priority);
    const payload = {
      channel: this.notificationConfig.slack.channel,
      username: this.notificationConfig.slack.username,
      attachments: [
        {
          color,
          title: notification.title,
          text: notification.message,
          timestamp: Math.floor(notification.timestamp.getTime() / 1000),
          fields: [
            {
              title: 'Priority',
              value: notification.priority,
              short: true,
            },
            {
              title: 'Timestamp',
              value: notification.timestamp.toISOString(),
              short: true,
            },
          ],
        },
      ],
    };

    await axios.post(this.notificationConfig.slack.webhookUrl, payload);
  }

  /**
   * Generate HTML email content
   */
  private async generateEmailHTML(data: EmailTemplateData): Promise<string> {
    // Basic HTML template - in production, you'd use a proper template engine
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${data.subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .priority-high { border-left: 4px solid #f44336; }
        .priority-medium { border-left: 4px solid #ff9800; }
        .priority-low { border-left: 4px solid #2196f3; }
        .metadata { background: #e0e0e0; padding: 10px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.title}</h1>
        </div>
        <div class="content priority-${data.priority}">
            <p><strong>Priority:</strong> ${data.priority.toUpperCase()}</p>
            <p><strong>Time:</strong> ${data.timestamp}</p>
            <div>${data.content.replace(/\n/g, '<br>')}</div>
            ${data.metadata ? `
            <div class="metadata">
                <h3>Additional Information</h3>
                <pre>${JSON.stringify(data.metadata, null, 2)}</pre>
            </div>
            ` : ''}
        </div>
        <div class="footer">
            <p>Golf Journey Map Automation System</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text email content
   */
  private async generateEmailText(data: EmailTemplateData): Promise<string> {
    let text = `${data.title}\n${'='.repeat(data.title.length)}\n\n`;
    text += `Priority: ${data.priority.toUpperCase()}\n`;
    text += `Time: ${data.timestamp}\n\n`;
    text += `${data.content}\n`;

    if (data.metadata) {
      text += `\nAdditional Information:\n`;
      text += JSON.stringify(data.metadata, null, 2);
    }

    text += `\n\n---\nGolf Journey Map Automation System`;

    return text;
  }

  /**
   * Get Slack color for priority
   */
  private getSlackColor(priority: string): string {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      default:
        return 'good';
    }
  }

  /**
   * Create alert group title
   */
  private createAlertGroupTitle(alerts: Alert[]): string {
    const firstAlert = alerts[0];
    const count = alerts.length;

    if (count === 1) {
      return `${firstAlert.level.toUpperCase()}: ${firstAlert.message}`;
    }

    return `${count} ${firstAlert.category} ${firstAlert.level} alerts`;
  }

  /**
   * Create alert group message
   */
  private createAlertGroupMessage(alerts: Alert[]): string {
    if (alerts.length === 1) {
      return alerts[0].message;
    }

    let message = `Multiple ${alerts[0].category} issues detected:\n\n`;

    alerts.forEach((alert, index) => {
      message += `${index + 1}. ${alert.message}\n`;
    });

    return message;
  }

  /**
   * Create completion message
   */
  private createCompletionMessage(summary: AutomationResult): string {
    const duration = Math.round(summary.totalDuration / 1000 / 60); // minutes
    const successRate = (summary.successfulCourses / summary.totalCourses * 100).toFixed(1);

    let message = `Automation workflow completed successfully.\n\n`;
    message += `Summary:\n`;
    message += `- Total courses processed: ${summary.totalCourses}\n`;
    message += `- Successful: ${summary.successfulCourses}\n`;
    message += `- Failed: ${summary.failedCourses}\n`;
    message += `- Success rate: ${successRate}%\n`;
    message += `- Average quality score: ${summary.averageQualityScore.toFixed(1)}\n`;
    message += `- Total duration: ${duration} minutes\n`;

    if (summary.failedCourses > 0) {
      message += `\nNote: ${summary.failedCourses} courses failed processing. Check the logs for details.`;
    }

    return message;
  }

  /**
   * Retry pending notifications
   */
  async retryPendingNotifications(): Promise<void> {
    if (!this.pendingNotifications.length) {
      return;
    }

    this.logger.info(`Retrying ${this.pendingNotifications.length} pending notifications`);

    const toRetry = [...this.pendingNotifications];
    this.pendingNotifications = [];

    for (const notification of toRetry) {
      await this.sendNotification(notification);
    }
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    total: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    recent: Alert[];
  } {
    const byLevel: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const alert of this.alertHistory) {
      byLevel[alert.level] = (byLevel[alert.level] || 0) + 1;
      byCategory[alert.category] = (byCategory[alert.category] || 0) + 1;
    }

    // Get recent alerts (last 24 hours)
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recent = this.alertHistory.filter(a => a.timestamp.getTime() > dayAgo);

    return {
      total: this.alertHistory.length,
      byLevel,
      byCategory,
      recent,
    };
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.resolvedAt = new Date();
      this.logger.info(`Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(daysOld = 30): number {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const initialCount = this.alertHistory.length;

    this.alertHistory = this.alertHistory.filter(a => a.timestamp.getTime() > cutoff);

    const removedCount = initialCount - this.alertHistory.length;
    this.logger.info(`Cleared ${removedCount} old alerts (older than ${daysOld} days)`);

    return removedCount;
  }
}

export { AlertManager };