#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

import { apiLogger } from '../utils/logger';
import { AlertManager } from '../services/alert-manager';

import type {
  MaintenanceTask,
  MaintenanceConfig,
  MaintenanceResult,
} from '../types/automation.types';

/**
 * Database maintenance statistics
 */
interface MaintenanceStats {
  logsRemoved: number;
  tempDataRemoved: number;
  indexesOptimized: number;
  dataArchived: number;
  integrityIssues: number;
  spaceSaved: number; // in bytes
  tablesVacuumed: number;
}

/**
 * Index fragmentation info
 */
interface IndexInfo {
  name: string;
  table: string;
  fragmentation: number;
  size: number;
}

/**
 * Database Maintenance System
 *
 * Handles automated database maintenance tasks including:
 * - Log cleanup
 * - Temporary data removal
 * - Index optimization
 * - Data archival
 * - Integrity checks
 * - Statistics updates
 */
export class DatabaseMaintenance {
  private readonly logger = apiLogger.child({ service: 'db-maintenance' });
  private readonly prisma: PrismaClient;
  private readonly alertManager: AlertManager;

  constructor() {
    this.prisma = new PrismaClient();
    this.alertManager = new AlertManager();

    this.logger.info('Database Maintenance system initialized');
  }

  /**
   * Run comprehensive maintenance tasks
   */
  async runMaintenanceTasks(config: Partial<MaintenanceConfig> = {}): Promise<MaintenanceResult> {
    const startTime = performance.now();
    const taskId = `maintenance-${Date.now()}`;

    this.logger.info('Starting database maintenance tasks', { taskId });

    const fullConfig: MaintenanceConfig = {
      retentionDays: 30,
      cleanupThreshold: 1000,
      optimizeIndexes: true,
      compressLogs: true,
      archiveData: true,
      ...config,
    };

    const stats: MaintenanceStats = {
      logsRemoved: 0,
      tempDataRemoved: 0,
      indexesOptimized: 0,
      dataArchived: 0,
      integrityIssues: 0,
      spaceSaved: 0,
      tablesVacuumed: 0,
    };

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Phase 1: Cleanup old logs
      this.logger.info('Phase 1: Cleaning up old logs');
      try {
        const logCleanup = await this.cleanupOldLogs(fullConfig.retentionDays!);
        stats.logsRemoved = logCleanup.itemsRemoved;
        stats.spaceSaved += logCleanup.spaceSaved;
      } catch (error) {
        const errorMsg = `Log cleanup failed: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg, error);
      }

      // Phase 2: Remove temporary data
      this.logger.info('Phase 2: Removing temporary processing data');
      try {
        const tempCleanup = await this.removeTempData(7); // 7 days for temp data
        stats.tempDataRemoved = tempCleanup.itemsRemoved;
        stats.spaceSaved += tempCleanup.spaceSaved;
      } catch (error) {
        const errorMsg = `Temp data cleanup failed: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg, error);
      }

      // Phase 3: Optimize indexes
      if (fullConfig.optimizeIndexes) {
        this.logger.info('Phase 3: Optimizing database indexes');
        try {
          const indexOptimization = await this.optimizeIndexes();
          stats.indexesOptimized = indexOptimization.itemsProcessed;
        } catch (error) {
          const errorMsg = `Index optimization failed: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg, error);
        }
      }

      // Phase 4: Archive old data
      if (fullConfig.archiveData) {
        this.logger.info('Phase 4: Archiving old data');
        try {
          const archival = await this.archiveOldData(fullConfig.retentionDays! * 6); // 6 months for archival
          stats.dataArchived = archival.itemsProcessed;
          stats.spaceSaved += archival.spaceSaved;
        } catch (error) {
          const errorMsg = `Data archival failed: ${error.message}`;
          warnings.push(errorMsg); // Non-critical
          this.logger.warn(errorMsg, error);
        }
      }

      // Phase 5: Update table statistics
      this.logger.info('Phase 5: Updating table statistics');
      try {
        await this.updateStatistics();
      } catch (error) {
        const errorMsg = `Statistics update failed: ${error.message}`;
        warnings.push(errorMsg);
        this.logger.warn(errorMsg, error);
      }

      // Phase 6: Run integrity checks
      this.logger.info('Phase 6: Running integrity checks');
      try {
        const integrityCheck = await this.runIntegrityChecks();
        stats.integrityIssues = integrityCheck.itemsProcessed;

        if (integrityCheck.itemsProcessed > 0) {
          warnings.push(`Found ${integrityCheck.itemsProcessed} integrity issues`);
        }
      } catch (error) {
        const errorMsg = `Integrity check failed: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg, error);
      }

      // Phase 7: Vacuum tables
      this.logger.info('Phase 7: Vacuuming tables');
      try {
        const vacuumResult = await this.vacuumTables();
        stats.tablesVacuumed = vacuumResult.itemsProcessed;
      } catch (error) {
        const errorMsg = `Table vacuum failed: ${error.message}`;
        warnings.push(errorMsg);
        this.logger.warn(errorMsg, error);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      const result: MaintenanceResult = {
        taskId,
        startTime: new Date(Date.now() - duration),
        endTime: new Date(),
        duration,
        success: errors.length === 0,
        itemsProcessed: stats.logsRemoved + stats.tempDataRemoved + stats.dataArchived,
        itemsRemoved: stats.logsRemoved + stats.tempDataRemoved,
        spaceSaved: stats.spaceSaved,
        errors,
        warnings,
      };

      this.logger.info('Database maintenance completed', {
        taskId,
        success: result.success,
        duration: Math.round(duration),
        spaceSaved: `${Math.round(stats.spaceSaved / 1024 / 1024)} MB`,
        logsRemoved: stats.logsRemoved,
        tempDataRemoved: stats.tempDataRemoved,
        indexesOptimized: stats.indexesOptimized,
        errorsCount: errors.length,
        warningsCount: warnings.length,
      });

      // Generate and save maintenance report
      await this.saveMaintenanceReport(result, stats);

      // Send alerts for any critical issues
      if (errors.length > 0 || stats.integrityIssues > 10) {
        await this.alertManager.sendMaintenanceAlert(result, stats);
      }

      return result;

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const result: MaintenanceResult = {
        taskId,
        startTime: new Date(Date.now() - duration),
        endTime: new Date(),
        duration,
        success: false,
        itemsProcessed: 0,
        itemsRemoved: 0,
        spaceSaved: 0,
        errors: [`Critical maintenance failure: ${error.message}`],
        warnings,
      };

      this.logger.error('Database maintenance failed:', error);
      await this.alertManager.sendMaintenanceAlert(result, stats);

      return result;
    }
  }

  /**
   * Clean up old log entries
   */
  private async cleanupOldLogs(retentionDays: number): Promise<{ itemsRemoved: number; spaceSaved: number }> {
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    this.logger.info(`Removing logs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);

    // Clean up automation logs
    const automationLogs = await this.prisma.$executeRaw`
      DELETE FROM automation_logs
      WHERE created_at < ${cutoffDate}
    `;

    // Clean up scraping logs
    const scrapingLogs = await this.prisma.$executeRaw`
      DELETE FROM scraping_logs
      WHERE created_at < ${cutoffDate}
    `;

    // Clean up quality assessment logs
    const qualityLogs = await this.prisma.$executeRaw`
      DELETE FROM quality_logs
      WHERE created_at < ${cutoffDate}
    `;

    // Clean up error logs
    const errorLogs = await this.prisma.$executeRaw`
      DELETE FROM error_logs
      WHERE created_at < ${cutoffDate}
    `;

    const totalRemoved = Number(automationLogs) + Number(scrapingLogs) + Number(qualityLogs) + Number(errorLogs);

    // Estimate space saved (approximate)
    const spaceSaved = totalRemoved * 500; // Assume 500 bytes per log entry

    this.logger.info('Log cleanup completed', {
      automationLogs: Number(automationLogs),
      scrapingLogs: Number(scrapingLogs),
      qualityLogs: Number(qualityLogs),
      errorLogs: Number(errorLogs),
      totalRemoved,
      spaceSaved: `${Math.round(spaceSaved / 1024)} KB`,
    });

    return { itemsRemoved: totalRemoved, spaceSaved };
  }

  /**
   * Remove temporary processing data
   */
  private async removeTempData(retentionDays: number): Promise<{ itemsRemoved: number; spaceSaved: number }> {
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    this.logger.info(`Removing temporary data older than ${retentionDays} days`);

    // Clean up temporary processing data
    const tempProcessingData = await this.prisma.$executeRaw`
      DELETE FROM temp_processing_data
      WHERE created_at < ${cutoffDate}
    `;

    // Clean up temporary scraping results
    const tempScrapingData = await this.prisma.$executeRaw`
      DELETE FROM temp_scraping_results
      WHERE created_at < ${cutoffDate}
    `;

    // Clean up temporary image processing data
    const tempImageData = await this.prisma.$executeRaw`
      DELETE FROM temp_image_processing
      WHERE created_at < ${cutoffDate}
    `;

    // Clean up failed download attempts
    const failedDownloads = await this.prisma.$executeRaw`
      DELETE FROM failed_downloads
      WHERE created_at < ${cutoffDate}
    `;

    const totalRemoved = Number(tempProcessingData) + Number(tempScrapingData) +
                        Number(tempImageData) + Number(failedDownloads);

    // Estimate space saved
    const spaceSaved = totalRemoved * 1024; // Assume 1KB per temp record

    this.logger.info('Temporary data cleanup completed', {
      tempProcessingData: Number(tempProcessingData),
      tempScrapingData: Number(tempScrapingData),
      tempImageData: Number(tempImageData),
      failedDownloads: Number(failedDownloads),
      totalRemoved,
      spaceSaved: `${Math.round(spaceSaved / 1024)} KB`,
    });

    return { itemsRemoved: totalRemoved, spaceSaved };
  }

  /**
   * Optimize database indexes
   */
  private async optimizeIndexes(): Promise<{ itemsProcessed: number }> {
    this.logger.info('Starting index optimization');

    // Get fragmented indexes
    const fragmentedIndexes = await this.findFragmentedIndexes();

    let optimizedCount = 0;

    for (const index of fragmentedIndexes) {
      try {
        this.logger.info(`Optimizing index: ${index.name} on table ${index.table}`);

        // Reindex the fragmented index
        await this.prisma.$executeRawUnsafe(`REINDEX INDEX ${index.name}`);
        optimizedCount++;

        this.logger.info(`Index optimized: ${index.name}`, {
          table: index.table,
          previousFragmentation: `${index.fragmentation}%`,
        });

      } catch (error) {
        this.logger.warn(`Failed to optimize index ${index.name}:`, error);
      }
    }

    this.logger.info('Index optimization completed', {
      totalIndexes: fragmentedIndexes.length,
      optimized: optimizedCount,
    });

    return { itemsProcessed: optimizedCount };
  }

  /**
   * Find fragmented indexes
   */
  private async findFragmentedIndexes(): Promise<IndexInfo[]> {
    // This is a simplified implementation
    // In a real PostgreSQL environment, you'd query pg_stat_user_indexes
    // and other system catalogs to find fragmented indexes

    const indexes: IndexInfo[] = [];

    try {
      // Query to find indexes with potential fragmentation
      // This is a mock implementation - actual queries would be database-specific
      const results = await this.prisma.$queryRaw`
        SELECT
          indexname as name,
          tablename as table,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND idx_tup_read > 1000
      ` as any[];

      for (const row of results) {
        // Calculate fragmentation heuristic
        const fragmentation = row.idx_tup_read > 0
          ? ((row.idx_tup_read - row.idx_tup_fetch) / row.idx_tup_read) * 100
          : 0;

        if (fragmentation > 30) { // Consider >30% fragmentation as needing optimization
          indexes.push({
            name: row.name,
            table: row.table,
            fragmentation: Math.round(fragmentation),
            size: 0, // Would calculate actual size
          });
        }
      }

    } catch (error) {
      this.logger.warn('Failed to analyze index fragmentation:', error);
    }

    return indexes;
  }

  /**
   * Archive old data
   */
  private async archiveOldData(retentionDays: number): Promise<{ itemsProcessed: number; spaceSaved: number }> {
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    this.logger.info(`Archiving data older than ${retentionDays} days`);

    let itemsProcessed = 0;
    let spaceSaved = 0;

    // Archive quality reports
    const qualityReports = await this.prisma.$queryRaw`
      SELECT COUNT(*) as count FROM quality_reports WHERE created_at < ${cutoffDate}
    ` as any[];

    if (qualityReports[0]?.count > 0) {
      // Move to archive table
      await this.prisma.$executeRaw`
        INSERT INTO quality_reports_archive
        SELECT * FROM quality_reports
        WHERE created_at < ${cutoffDate}
      `;

      // Delete from main table
      const archived = await this.prisma.$executeRaw`
        DELETE FROM quality_reports
        WHERE created_at < ${cutoffDate}
      `;

      itemsProcessed += Number(archived);
      spaceSaved += Number(archived) * 2048; // Estimate 2KB per report
    }

    // Archive old scraping results
    const scrapingResults = await this.prisma.$executeRaw`
      INSERT INTO scraping_results_archive
      SELECT * FROM scraping_results
      WHERE created_at < ${cutoffDate}
    `;

    const archivedScraping = await this.prisma.$executeRaw`
      DELETE FROM scraping_results
      WHERE created_at < ${cutoffDate}
    `;

    itemsProcessed += Number(archivedScraping);
    spaceSaved += Number(archivedScraping) * 1024; // Estimate 1KB per result

    // Archive old automation runs
    const automationRuns = await this.prisma.$executeRaw`
      INSERT INTO automation_runs_archive
      SELECT * FROM automation_runs
      WHERE created_at < ${cutoffDate}
    `;

    const archivedRuns = await this.prisma.$executeRaw`
      DELETE FROM automation_runs
      WHERE created_at < ${cutoffDate}
    `;

    itemsProcessed += Number(archivedRuns);

    this.logger.info('Data archival completed', {
      qualityReports: qualityReports[0]?.count || 0,
      scrapingResults: Number(archivedScraping),
      automationRuns: Number(archivedRuns),
      totalArchived: itemsProcessed,
      spaceSaved: `${Math.round(spaceSaved / 1024 / 1024)} MB`,
    });

    return { itemsProcessed, spaceSaved };
  }

  /**
   * Update table statistics
   */
  private async updateStatistics(): Promise<void> {
    this.logger.info('Updating table statistics');

    // Analyze main tables to update statistics
    const tables = [
      'golf_courses',
      'scraping_results',
      'quality_reports',
      'automation_runs',
      'course_images',
      'weather_data',
    ];

    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`ANALYZE ${table}`);
        this.logger.debug(`Statistics updated for table: ${table}`);
      } catch (error) {
        this.logger.warn(`Failed to update statistics for ${table}:`, error);
      }
    }

    this.logger.info('Table statistics update completed');
  }

  /**
   * Run database integrity checks
   */
  private async runIntegrityChecks(): Promise<{ itemsProcessed: number }> {
    this.logger.info('Running database integrity checks');

    let issuesFound = 0;

    try {
      // Check for orphaned records
      const orphanedImages = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM course_images ci
        LEFT JOIN golf_courses gc ON ci.course_id = gc.id
        WHERE gc.id IS NULL
      ` as any[];

      if (orphanedImages[0]?.count > 0) {
        this.logger.warn(`Found ${orphanedImages[0].count} orphaned course images`);
        issuesFound += Number(orphanedImages[0].count);
      }

      // Check for duplicate entries
      const duplicateCourses = await this.prisma.$queryRaw`
        SELECT name, COUNT(*) as count
        FROM golf_courses
        GROUP BY name, city, state
        HAVING COUNT(*) > 1
      ` as any[];

      if (duplicateCourses.length > 0) {
        this.logger.warn(`Found ${duplicateCourses.length} potential duplicate courses`);
        issuesFound += duplicateCourses.length;
      }

      // Check for missing required data
      const incompleteRecords = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM golf_courses
        WHERE name IS NULL OR name = '' OR city IS NULL OR city = ''
      ` as any[];

      if (incompleteRecords[0]?.count > 0) {
        this.logger.warn(`Found ${incompleteRecords[0].count} courses with missing required data`);
        issuesFound += Number(incompleteRecords[0].count);
      }

      // Check for invalid quality scores
      const invalidScores = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM quality_reports
        WHERE overall_score < 0 OR overall_score > 100
      ` as any[];

      if (invalidScores[0]?.count > 0) {
        this.logger.warn(`Found ${invalidScores[0].count} quality reports with invalid scores`);
        issuesFound += Number(invalidScores[0].count);
      }

    } catch (error) {
      this.logger.error('Integrity check failed:', error);
      throw error;
    }

    this.logger.info('Database integrity checks completed', {
      issuesFound,
      status: issuesFound === 0 ? 'healthy' : 'issues_found',
    });

    return { itemsProcessed: issuesFound };
  }

  /**
   * Vacuum tables to reclaim space
   */
  private async vacuumTables(): Promise<{ itemsProcessed: number }> {
    this.logger.info('Starting table vacuum operation');

    const tables = [
      'golf_courses',
      'scraping_results',
      'quality_reports',
      'automation_runs',
      'course_images',
      'weather_data',
      'automation_logs',
    ];

    let vacuumedCount = 0;

    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`VACUUM ANALYZE ${table}`);
        vacuumedCount++;
        this.logger.debug(`Vacuumed table: ${table}`);
      } catch (error) {
        this.logger.warn(`Failed to vacuum table ${table}:`, error);
      }
    }

    this.logger.info('Table vacuum completed', {
      totalTables: tables.length,
      vacuumed: vacuumedCount,
    });

    return { itemsProcessed: vacuumedCount };
  }

  /**
   * Save maintenance report
   */
  private async saveMaintenanceReport(result: MaintenanceResult, stats: MaintenanceStats): Promise<void> {
    try {
      const reportsDir = path.join(process.cwd(), 'reports', 'maintenance');
      await fs.mkdir(reportsDir, { recursive: true });

      const report = {
        ...result,
        detailedStats: stats,
        timestamp: new Date().toISOString(),
      };

      const filename = `maintenance-${result.taskId}.json`;
      const reportPath = path.join(reportsDir, filename);

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      this.logger.info('Maintenance report saved', { reportPath });

    } catch (error) {
      this.logger.error('Failed to save maintenance report:', error);
    }
  }

  /**
   * Get maintenance statistics
   */
  async getMaintenanceStats(): Promise<{
    lastMaintenanceRun: Date | null;
    totalLogEntries: number;
    totalTempData: number;
    databaseSize: string;
    oldestLogEntry: Date | null;
  }> {
    try {
      // Get last maintenance run
      const lastRun = await this.prisma.$queryRaw`
        SELECT MAX(created_at) as last_run FROM maintenance_logs
      ` as any[];

      // Get log entry counts
      const logCounts = await this.prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*) FROM automation_logs) as automation_logs,
          (SELECT COUNT(*) FROM scraping_logs) as scraping_logs,
          (SELECT COUNT(*) FROM quality_logs) as quality_logs,
          (SELECT COUNT(*) FROM error_logs) as error_logs
      ` as any[];

      // Get temp data count
      const tempData = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count FROM temp_processing_data
      ` as any[];

      // Get oldest log entry
      const oldestLog = await this.prisma.$queryRaw`
        SELECT MIN(created_at) as oldest FROM automation_logs
      ` as any[];

      const stats = logCounts[0] || {};
      const totalLogs = (stats.automation_logs || 0) + (stats.scraping_logs || 0) +
                       (stats.quality_logs || 0) + (stats.error_logs || 0);

      return {
        lastMaintenanceRun: lastRun[0]?.last_run || null,
        totalLogEntries: totalLogs,
        totalTempData: tempData[0]?.count || 0,
        databaseSize: 'Unknown', // Would require database-specific queries
        oldestLogEntry: oldestLog[0]?.oldest || null,
      };

    } catch (error) {
      this.logger.error('Failed to get maintenance statistics:', error);
      return {
        lastMaintenanceRun: null,
        totalLogEntries: 0,
        totalTempData: 0,
        databaseSize: 'Unknown',
        oldestLogEntry: null,
      };
    }
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
    this.logger.info('Database maintenance cleanup completed');
  }
}

// CLI execution when run directly
async function main() {
  if (require.main === module) {
    const maintenance = new DatabaseMaintenance();

    try {
      const args = process.argv.slice(2);
      const config: Partial<MaintenanceConfig> = {};

      // Parse command line arguments
      if (args.includes('--retention-days')) {
        const index = args.indexOf('--retention-days');
        config.retentionDays = parseInt(args[index + 1]) || 30;
      }

      if (args.includes('--full-maintenance')) {
        config.optimizeIndexes = true;
        config.archiveData = true;
        config.compressLogs = true;
      }

      if (args.includes('--no-optimization')) {
        config.optimizeIndexes = false;
      }

      const result = await maintenance.runMaintenanceTasks(config);

      console.log('Database maintenance completed:');
      console.log(`- Success: ${result.success}`);
      console.log(`- Duration: ${Math.round(result.duration / 1000)} seconds`);
      console.log(`- Items processed: ${result.itemsProcessed}`);
      console.log(`- Items removed: ${result.itemsRemoved}`);
      console.log(`- Space saved: ${Math.round(result.spaceSaved / 1024 / 1024)} MB`);

      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(error => console.log(`- ${error}`));
      }

      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach(warning => console.log(`- ${warning}`));
      }

      await maintenance.cleanup();

      process.exit(result.success ? 0 : 1);

    } catch (error) {
      console.error('Database maintenance failed:', error);
      await maintenance.cleanup();
      process.exit(1);
    }
  }
}

// Export for use as module
export { DatabaseMaintenance };

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}