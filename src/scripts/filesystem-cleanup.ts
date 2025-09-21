#!/usr/bin/env node

import { promises as fs, constants } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { glob } from 'glob';

import { apiLogger } from '../utils/logger';
import { AlertManager } from '../services/alert-manager';

import type {
  MaintenanceTask,
  MaintenanceConfig,
  MaintenanceResult,
} from '../types/automation.types';

/**
 * File system cleanup statistics
 */
interface CleanupStats {
  tempFilesRemoved: number;
  logFilesArchived: number;
  orphanedImagesRemoved: number;
  duplicateFilesRemoved: number;
  emptyDirectoriesRemoved: number;
  totalSpaceSaved: number; // in bytes
  largeFilesFound: number;
  oldDownloadsRemoved: number;
}

/**
 * File information
 */
interface FileInfo {
  path: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
}

/**
 * Directory cleanup configuration
 */
interface DirectoryConfig {
  path: string;
  retentionDays: number;
  maxSize: number; // in bytes
  extensions?: string[];
  recursive: boolean;
  preserveStructure: boolean;
}

/**
 * File System Cleanup System
 *
 * Handles automated file system maintenance including:
 * - Temporary file cleanup
 * - Log file archival and rotation
 * - Orphaned file removal
 * - Duplicate file detection
 * - Large file management
 * - Directory optimization
 */
export class FileSystemCleanup {
  private readonly logger = apiLogger.child({ service: 'filesystem-cleanup' });
  private readonly alertManager: AlertManager;

  // Default cleanup directories
  private readonly cleanupDirectories: DirectoryConfig[] = [
    {
      path: path.join(process.cwd(), 'data', 'temp'),
      retentionDays: 7,
      maxSize: 100 * 1024 * 1024, // 100MB
      recursive: true,
      preserveStructure: false,
    },
    {
      path: path.join(process.cwd(), 'logs'),
      retentionDays: 90,
      maxSize: 500 * 1024 * 1024, // 500MB
      extensions: ['.log', '.log.gz'],
      recursive: true,
      preserveStructure: true,
    },
    {
      path: path.join(process.cwd(), 'media', 'temp'),
      retentionDays: 3,
      maxSize: 1024 * 1024 * 1024, // 1GB
      extensions: ['.jpg', '.jpeg', '.png', '.webp', '.tmp'],
      recursive: true,
      preserveStructure: false,
    },
    {
      path: path.join(process.cwd(), 'reports'),
      retentionDays: 180,
      maxSize: 200 * 1024 * 1024, // 200MB
      extensions: ['.json', '.html', '.pdf'],
      recursive: true,
      preserveStructure: true,
    },
  ];

  constructor() {
    this.alertManager = new AlertManager();
    this.logger.info('File System Cleanup system initialized');
  }

  /**
   * Run comprehensive file system cleanup
   */
  async runCleanupTasks(config: Partial<MaintenanceConfig> = {}): Promise<MaintenanceResult> {
    const startTime = performance.now();
    const taskId = `filesystem-cleanup-${Date.now()}`;

    this.logger.info('Starting file system cleanup tasks', { taskId });

    const fullConfig: MaintenanceConfig = {
      retentionDays: 30,
      cleanupThreshold: 1000,
      ...config,
    };

    const stats: CleanupStats = {
      tempFilesRemoved: 0,
      logFilesArchived: 0,
      orphanedImagesRemoved: 0,
      duplicateFilesRemoved: 0,
      emptyDirectoriesRemoved: 0,
      totalSpaceSaved: 0,
      largeFilesFound: 0,
      oldDownloadsRemoved: 0,
    };

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Phase 1: Clean temporary files
      this.logger.info('Phase 1: Cleaning temporary files');
      try {
        const tempCleanup = await this.cleanTempFiles();
        stats.tempFilesRemoved = tempCleanup.filesRemoved;
        stats.totalSpaceSaved += tempCleanup.spaceSaved;
      } catch (error) {
        const errorMsg = `Temp file cleanup failed: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg, error);
      }

      // Phase 2: Archive and rotate log files
      this.logger.info('Phase 2: Archiving log files');
      try {
        const logCleanup = await this.archiveLogFiles();
        stats.logFilesArchived = logCleanup.filesProcessed;
        stats.totalSpaceSaved += logCleanup.spaceSaved;
      } catch (error) {
        const errorMsg = `Log archival failed: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg, error);
      }

      // Phase 3: Remove orphaned images
      this.logger.info('Phase 3: Removing orphaned images');
      try {
        const orphanCleanup = await this.removeOrphanedImages();
        stats.orphanedImagesRemoved = orphanCleanup.filesRemoved;
        stats.totalSpaceSaved += orphanCleanup.spaceSaved;
      } catch (error) {
        const errorMsg = `Orphaned image cleanup failed: ${error.message}`;
        warnings.push(errorMsg); // Non-critical
        this.logger.warn(errorMsg, error);
      }

      // Phase 4: Remove duplicate files
      this.logger.info('Phase 4: Removing duplicate files');
      try {
        const duplicateCleanup = await this.removeDuplicateFiles();
        stats.duplicateFilesRemoved = duplicateCleanup.filesRemoved;
        stats.totalSpaceSaved += duplicateCleanup.spaceSaved;
      } catch (error) {
        const errorMsg = `Duplicate file cleanup failed: ${error.message}`;
        warnings.push(errorMsg);
        this.logger.warn(errorMsg, error);
      }

      // Phase 5: Clean old downloads
      this.logger.info('Phase 5: Cleaning old download files');
      try {
        const downloadCleanup = await this.cleanOldDownloads(fullConfig.retentionDays!);
        stats.oldDownloadsRemoved = downloadCleanup.filesRemoved;
        stats.totalSpaceSaved += downloadCleanup.spaceSaved;
      } catch (error) {
        const errorMsg = `Download cleanup failed: ${error.message}`;
        warnings.push(errorMsg);
        this.logger.warn(errorMsg, error);
      }

      // Phase 6: Remove empty directories
      this.logger.info('Phase 6: Removing empty directories');
      try {
        const dirCleanup = await this.removeEmptyDirectories();
        stats.emptyDirectoriesRemoved = dirCleanup.dirsRemoved;
      } catch (error) {
        const errorMsg = `Empty directory cleanup failed: ${error.message}`;
        warnings.push(errorMsg);
        this.logger.warn(errorMsg, error);
      }

      // Phase 7: Find and report large files
      this.logger.info('Phase 7: Analyzing large files');
      try {
        const largeFileAnalysis = await this.analyzeLargeFiles();
        stats.largeFilesFound = largeFileAnalysis.count;

        if (largeFileAnalysis.count > 0) {
          warnings.push(`Found ${largeFileAnalysis.count} large files that may need attention`);
        }
      } catch (error) {
        const errorMsg = `Large file analysis failed: ${error.message}`;
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
        itemsProcessed: stats.tempFilesRemoved + stats.logFilesArchived + stats.orphanedImagesRemoved,
        itemsRemoved: stats.tempFilesRemoved + stats.orphanedImagesRemoved + stats.duplicateFilesRemoved,
        spaceSaved: stats.totalSpaceSaved,
        errors,
        warnings,
      };

      this.logger.info('File system cleanup completed', {
        taskId,
        success: result.success,
        duration: Math.round(duration),
        spaceSaved: `${Math.round(stats.totalSpaceSaved / 1024 / 1024)} MB`,
        tempFilesRemoved: stats.tempFilesRemoved,
        logFilesArchived: stats.logFilesArchived,
        orphanedImagesRemoved: stats.orphanedImagesRemoved,
        errorsCount: errors.length,
        warningsCount: warnings.length,
      });

      // Save cleanup report
      await this.saveCleanupReport(result, stats);

      // Send alerts for any critical issues
      if (errors.length > 0 || stats.totalSpaceSaved > 1024 * 1024 * 1024) { // >1GB saved
        await this.alertManager.sendFilesystemCleanupAlert(result, stats);
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
        errors: [`Critical cleanup failure: ${error.message}`],
        warnings,
      };

      this.logger.error('File system cleanup failed:', error);
      await this.alertManager.sendFilesystemCleanupAlert(result, stats);

      return result;
    }
  }

  /**
   * Clean temporary files
   */
  private async cleanTempFiles(): Promise<{ filesRemoved: number; spaceSaved: number }> {
    this.logger.info('Cleaning temporary files');

    let filesRemoved = 0;
    let spaceSaved = 0;

    const tempDirs = [
      path.join(process.cwd(), 'data', 'temp'),
      path.join(process.cwd(), 'media', 'temp'),
      path.join(process.cwd(), 'tmp'),
      path.join(process.cwd(), '.tmp'),
    ];

    for (const tempDir of tempDirs) {
      try {
        await fs.access(tempDir, constants.F_OK);
        const result = await this.cleanDirectory(tempDir, 7, true); // 7 days retention
        filesRemoved += result.filesRemoved;
        spaceSaved += result.spaceSaved;
      } catch (error) {
        // Directory doesn't exist, skip
        continue;
      }
    }

    // Clean OS-specific temp files
    await this.cleanOSTempFiles();

    // Clean failed download attempts
    const failedDownloadsDir = path.join(process.cwd(), 'data', 'downloads', 'failed');
    try {
      await fs.access(failedDownloadsDir, constants.F_OK);
      const result = await this.cleanDirectory(failedDownloadsDir, 1, true); // 1 day retention
      filesRemoved += result.filesRemoved;
      spaceSaved += result.spaceSaved;
    } catch (error) {
      // Directory doesn't exist
    }

    this.logger.info('Temporary file cleanup completed', {
      filesRemoved,
      spaceSaved: `${Math.round(spaceSaved / 1024)} KB`,
    });

    return { filesRemoved, spaceSaved };
  }

  /**
   * Archive log files
   */
  private async archiveLogFiles(): Promise<{ filesProcessed: number; spaceSaved: number }> {
    this.logger.info('Archiving log files');

    const logsDir = path.join(process.cwd(), 'logs');
    let filesProcessed = 0;
    let spaceSaved = 0;

    try {
      await fs.access(logsDir, constants.F_OK);
    } catch (error) {
      this.logger.info('Logs directory does not exist, skipping log archival');
      return { filesProcessed: 0, spaceSaved: 0 };
    }

    // Find log files older than 30 days
    const cutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    const logFiles = await glob('**/*.log', { cwd: logsDir });

    for (const logFile of logFiles) {
      const logPath = path.join(logsDir, logFile);

      try {
        const stats = await fs.stat(logPath);

        if (stats.mtime < cutoffDate) {
          // Compress the log file
          const gzipPath = `${logPath}.gz`;

          if (!(await this.fileExists(gzipPath))) {
            await this.compressFile(logPath, gzipPath);
            const originalSize = stats.size;
            const compressedStats = await fs.stat(gzipPath);
            spaceSaved += originalSize - compressedStats.size;

            // Remove original file
            await fs.unlink(logPath);
            filesProcessed++;

            this.logger.debug(`Compressed log file: ${logFile}`);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to process log file ${logFile}:`, error);
      }
    }

    // Remove very old compressed logs (older than 90 days)
    const oldCutoffDate = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));
    const gzipFiles = await glob('**/*.log.gz', { cwd: logsDir });

    for (const gzipFile of gzipFiles) {
      const gzipPath = path.join(logsDir, gzipFile);

      try {
        const stats = await fs.stat(gzipPath);

        if (stats.mtime < oldCutoffDate) {
          spaceSaved += stats.size;
          await fs.unlink(gzipPath);
          filesProcessed++;

          this.logger.debug(`Removed old compressed log: ${gzipFile}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to remove old log ${gzipFile}:`, error);
      }
    }

    this.logger.info('Log file archival completed', {
      filesProcessed,
      spaceSaved: `${Math.round(spaceSaved / 1024)} KB`,
    });

    return { filesProcessed, spaceSaved };
  }

  /**
   * Remove orphaned images
   */
  private async removeOrphanedImages(): Promise<{ filesRemoved: number; spaceSaved: number }> {
    this.logger.info('Removing orphaned images');

    const mediaDir = path.join(process.cwd(), 'media');
    let filesRemoved = 0;
    let spaceSaved = 0;

    try {
      await fs.access(mediaDir, constants.F_OK);
    } catch (error) {
      this.logger.info('Media directory does not exist, skipping orphaned image cleanup');
      return { filesRemoved: 0, spaceSaved: 0 };
    }

    // Find all image files
    const imageExtensions = ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.webp', '**/*.gif'];
    const imageFiles: string[] = [];

    for (const pattern of imageExtensions) {
      const files = await glob(pattern, { cwd: mediaDir });
      imageFiles.push(...files.map(f => path.join(mediaDir, f)));
    }

    // Check each image file for orphaned status
    for (const imagePath of imageFiles) {
      try {
        const isOrphaned = await this.isImageOrphaned(imagePath);

        if (isOrphaned) {
          const stats = await fs.stat(imagePath);
          spaceSaved += stats.size;
          await fs.unlink(imagePath);
          filesRemoved++;

          this.logger.debug(`Removed orphaned image: ${path.relative(mediaDir, imagePath)}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to check image ${imagePath}:`, error);
      }
    }

    this.logger.info('Orphaned image cleanup completed', {
      filesRemoved,
      spaceSaved: `${Math.round(spaceSaved / 1024)} KB`,
    });

    return { filesRemoved, spaceSaved };
  }

  /**
   * Remove duplicate files
   */
  private async removeDuplicateFiles(): Promise<{ filesRemoved: number; spaceSaved: number }> {
    this.logger.info('Removing duplicate files');

    let filesRemoved = 0;
    let spaceSaved = 0;

    const dirsToCheck = [
      path.join(process.cwd(), 'media'),
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'reports'),
    ];

    for (const dir of dirsToCheck) {
      try {
        await fs.access(dir, constants.F_OK);
        const result = await this.findAndRemoveDuplicatesInDirectory(dir);
        filesRemoved += result.filesRemoved;
        spaceSaved += result.spaceSaved;
      } catch (error) {
        // Directory doesn't exist, skip
        continue;
      }
    }

    this.logger.info('Duplicate file cleanup completed', {
      filesRemoved,
      spaceSaved: `${Math.round(spaceSaved / 1024)} KB`,
    });

    return { filesRemoved, spaceSaved };
  }

  /**
   * Clean old download files
   */
  private async cleanOldDownloads(retentionDays: number): Promise<{ filesRemoved: number; spaceSaved: number }> {
    this.logger.info(`Cleaning downloads older than ${retentionDays} days`);

    const downloadsDir = path.join(process.cwd(), 'data', 'downloads');
    let filesRemoved = 0;
    let spaceSaved = 0;

    try {
      await fs.access(downloadsDir, constants.F_OK);
      const result = await this.cleanDirectory(downloadsDir, retentionDays, true);
      filesRemoved = result.filesRemoved;
      spaceSaved = result.spaceSaved;
    } catch (error) {
      this.logger.info('Downloads directory does not exist, skipping');
    }

    return { filesRemoved, spaceSaved };
  }

  /**
   * Remove empty directories
   */
  private async removeEmptyDirectories(): Promise<{ dirsRemoved: number }> {
    this.logger.info('Removing empty directories');

    let dirsRemoved = 0;

    const rootDirs = [
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'media'),
      path.join(process.cwd(), 'logs'),
      path.join(process.cwd(), 'reports'),
    ];

    for (const rootDir of rootDirs) {
      try {
        await fs.access(rootDir, constants.F_OK);
        const removed = await this.removeEmptyDirsRecursive(rootDir);
        dirsRemoved += removed;
      } catch (error) {
        // Directory doesn't exist, skip
        continue;
      }
    }

    this.logger.info('Empty directory cleanup completed', { dirsRemoved });

    return { dirsRemoved };
  }

  /**
   * Analyze large files
   */
  private async analyzeLargeFiles(): Promise<{ count: number; totalSize: number }> {
    this.logger.info('Analyzing large files');

    const largeFileThreshold = 100 * 1024 * 1024; // 100MB
    let count = 0;
    let totalSize = 0;

    const dirsToCheck = [
      path.join(process.cwd(), 'media'),
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'logs'),
    ];

    for (const dir of dirsToCheck) {
      try {
        await fs.access(dir, constants.F_OK);
        const largeFiles = await this.findLargeFiles(dir, largeFileThreshold);

        for (const file of largeFiles) {
          count++;
          totalSize += file.size;
          this.logger.info(`Large file found: ${file.path} (${Math.round(file.size / 1024 / 1024)} MB)`);
        }
      } catch (error) {
        // Directory doesn't exist, skip
        continue;
      }
    }

    this.logger.info('Large file analysis completed', {
      count,
      totalSize: `${Math.round(totalSize / 1024 / 1024)} MB`,
    });

    return { count, totalSize };
  }

  /**
   * Clean a directory based on retention policy
   */
  private async cleanDirectory(
    dirPath: string,
    retentionDays: number,
    recursive: boolean
  ): Promise<{ filesRemoved: number; spaceSaved: number }> {
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
    let filesRemoved = 0;
    let spaceSaved = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && recursive) {
          const result = await this.cleanDirectory(entryPath, retentionDays, recursive);
          filesRemoved += result.filesRemoved;
          spaceSaved += result.spaceSaved;
        } else if (entry.isFile()) {
          const stats = await fs.stat(entryPath);

          if (stats.mtime < cutoffDate) {
            spaceSaved += stats.size;
            await fs.unlink(entryPath);
            filesRemoved++;

            this.logger.debug(`Removed old file: ${path.relative(process.cwd(), entryPath)}`);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to clean directory ${dirPath}:`, error);
    }

    return { filesRemoved, spaceSaved };
  }

  /**
   * Check if an image file is orphaned
   */
  private async isImageOrphaned(imagePath: string): Promise<boolean> {
    // This is a simplified implementation
    // In a real system, you'd check if the image is referenced in the database

    // Check if the image is in a course-specific directory that no longer exists in DB
    const relativePath = path.relative(path.join(process.cwd(), 'media'), imagePath);
    const pathParts = relativePath.split(path.sep);

    if (pathParts.length > 2 && pathParts[0] === 'courses') {
      const courseId = pathParts[1];

      // Mock check - in real implementation, query database
      // return !(await this.courseExistsInDatabase(courseId));
      return false; // For now, assume no images are orphaned
    }

    return false;
  }

  /**
   * Find and remove duplicates in a directory
   */
  private async findAndRemoveDuplicatesInDirectory(
    dirPath: string
  ): Promise<{ filesRemoved: number; spaceSaved: number }> {
    const fileHashes = new Map<string, string[]>();
    let filesRemoved = 0;
    let spaceSaved = 0;

    // Recursively find all files and calculate hashes
    await this.hashFilesRecursive(dirPath, fileHashes);

    // Find and remove duplicates
    for (const [hash, filePaths] of fileHashes) {
      if (filePaths.length > 1) {
        // Keep the first file, remove the rest
        const filesToRemove = filePaths.slice(1);

        for (const filePath of filesToRemove) {
          try {
            const stats = await fs.stat(filePath);
            spaceSaved += stats.size;
            await fs.unlink(filePath);
            filesRemoved++;

            this.logger.debug(`Removed duplicate file: ${path.relative(dirPath, filePath)}`);
          } catch (error) {
            this.logger.warn(`Failed to remove duplicate ${filePath}:`, error);
          }
        }
      }
    }

    return { filesRemoved, spaceSaved };
  }

  /**
   * Hash files recursively
   */
  private async hashFilesRecursive(dirPath: string, fileHashes: Map<string, string[]>): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.hashFilesRecursive(entryPath, fileHashes);
        } else if (entry.isFile()) {
          const hash = await this.calculateFileHash(entryPath);
          if (!fileHashes.has(hash)) {
            fileHashes.set(hash, []);
          }
          fileHashes.get(hash)!.push(entryPath);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to hash files in ${dirPath}:`, error);
    }
  }

  /**
   * Calculate file hash
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const crypto = require('crypto');
    const content = await fs.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Remove empty directories recursively
   */
  private async removeEmptyDirsRecursive(dirPath: string): Promise<number> {
    let removed = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // First, recursively process subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(dirPath, entry.name);
          removed += await this.removeEmptyDirsRecursive(subDirPath);
        }
      }

      // Check if directory is now empty
      const updatedEntries = await fs.readdir(dirPath);
      if (updatedEntries.length === 0) {
        // Don't remove important directories
        const importantDirs = ['logs', 'data', 'media', 'reports'];
        const dirName = path.basename(dirPath);

        if (!importantDirs.includes(dirName)) {
          await fs.rmdir(dirPath);
          removed++;
          this.logger.debug(`Removed empty directory: ${path.relative(process.cwd(), dirPath)}`);
        }
      }
    } catch (error) {
      // Directory might not exist or not be empty, ignore
    }

    return removed;
  }

  /**
   * Find large files in directory
   */
  private async findLargeFiles(dirPath: string, threshold: number): Promise<FileInfo[]> {
    const largeFiles: FileInfo[] = [];

    try {
      await this.findLargeFilesRecursive(dirPath, threshold, largeFiles);
    } catch (error) {
      this.logger.warn(`Failed to find large files in ${dirPath}:`, error);
    }

    return largeFiles;
  }

  /**
   * Find large files recursively
   */
  private async findLargeFilesRecursive(
    dirPath: string,
    threshold: number,
    largeFiles: FileInfo[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.findLargeFilesRecursive(entryPath, threshold, largeFiles);
        } else if (entry.isFile()) {
          const stats = await fs.stat(entryPath);

          if (stats.size > threshold) {
            largeFiles.push({
              path: entryPath,
              size: stats.size,
              lastModified: stats.mtime,
              isDirectory: false,
            });
          }
        }
      }
    } catch (error) {
      // Directory might not be accessible, skip
    }
  }

  /**
   * Clean OS-specific temporary files
   */
  private async cleanOSTempFiles(): Promise<void> {
    const patterns = [
      '**/.DS_Store',     // macOS
      '**/Thumbs.db',     // Windows
      '**/.tmp*',         // General temp files
      '**/*~',            // Backup files
      '**/*.tmp',         // Temp files
      '**/*.bak',         // Backup files
    ];

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { cwd: process.cwd() });

        for (const file of files) {
          try {
            await fs.unlink(path.join(process.cwd(), file));
            this.logger.debug(`Removed OS temp file: ${file}`);
          } catch (error) {
            // File might not exist or be in use, ignore
          }
        }
      } catch (error) {
        // Pattern might not match anything, ignore
      }
    }
  }

  /**
   * Compress a file using gzip
   */
  private async compressFile(sourcePath: string, targetPath: string): Promise<void> {
    const zlib = require('zlib');
    const { createReadStream, createWriteStream } = require('fs');

    return new Promise((resolve, reject) => {
      const readStream = createReadStream(sourcePath);
      const writeStream = createWriteStream(targetPath);
      const gzip = zlib.createGzip();

      readStream
        .pipe(gzip)
        .pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save cleanup report
   */
  private async saveCleanupReport(result: MaintenanceResult, stats: CleanupStats): Promise<void> {
    try {
      const reportsDir = path.join(process.cwd(), 'reports', 'filesystem');
      await fs.mkdir(reportsDir, { recursive: true });

      const report = {
        ...result,
        detailedStats: stats,
        timestamp: new Date().toISOString(),
      };

      const filename = `filesystem-cleanup-${result.taskId}.json`;
      const reportPath = path.join(reportsDir, filename);

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      this.logger.info('Cleanup report saved', { reportPath });

    } catch (error) {
      this.logger.error('Failed to save cleanup report:', error);
    }
  }

  /**
   * Get file system statistics
   */
  async getFileSystemStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    tempFiles: number;
    logFiles: number;
    imageFiles: number;
    oldestFile: Date | null;
  }> {
    let totalFiles = 0;
    let totalSize = 0;
    let tempFiles = 0;
    let logFiles = 0;
    let imageFiles = 0;
    let oldestFile: Date | null = null;

    const dirsToScan = [
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'media'),
      path.join(process.cwd(), 'logs'),
    ];

    for (const dir of dirsToScan) {
      try {
        await fs.access(dir, constants.F_OK);
        const stats = await this.scanDirectoryStats(dir);

        totalFiles += stats.fileCount;
        totalSize += stats.totalSize;
        tempFiles += stats.tempFiles;
        logFiles += stats.logFiles;
        imageFiles += stats.imageFiles;

        if (stats.oldestFile && (!oldestFile || stats.oldestFile < oldestFile)) {
          oldestFile = stats.oldestFile;
        }
      } catch (error) {
        // Directory doesn't exist, skip
      }
    }

    return {
      totalFiles,
      totalSize,
      tempFiles,
      logFiles,
      imageFiles,
      oldestFile,
    };
  }

  /**
   * Scan directory for statistics
   */
  private async scanDirectoryStats(dirPath: string): Promise<{
    fileCount: number;
    totalSize: number;
    tempFiles: number;
    logFiles: number;
    imageFiles: number;
    oldestFile: Date | null;
  }> {
    let fileCount = 0;
    let totalSize = 0;
    let tempFiles = 0;
    let logFiles = 0;
    let imageFiles = 0;
    let oldestFile: Date | null = null;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subStats = await this.scanDirectoryStats(entryPath);
          fileCount += subStats.fileCount;
          totalSize += subStats.totalSize;
          tempFiles += subStats.tempFiles;
          logFiles += subStats.logFiles;
          imageFiles += subStats.imageFiles;

          if (subStats.oldestFile && (!oldestFile || subStats.oldestFile < oldestFile)) {
            oldestFile = subStats.oldestFile;
          }
        } else if (entry.isFile()) {
          const stats = await fs.stat(entryPath);
          fileCount++;
          totalSize += stats.size;

          if (!oldestFile || stats.mtime < oldestFile) {
            oldestFile = stats.mtime;
          }

          // Categorize files
          const ext = path.extname(entry.name).toLowerCase();
          if (entry.name.includes('temp') || entry.name.includes('tmp') || ext === '.tmp') {
            tempFiles++;
          } else if (ext === '.log' || ext === '.gz') {
            logFiles++;
          } else if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
            imageFiles++;
          }
        }
      }
    } catch (error) {
      // Error reading directory, skip
    }

    return {
      fileCount,
      totalSize,
      tempFiles,
      logFiles,
      imageFiles,
      oldestFile,
    };
  }
}

// CLI execution when run directly
async function main() {
  if (require.main === module) {
    const cleanup = new FileSystemCleanup();

    try {
      const args = process.argv.slice(2);
      const config: Partial<MaintenanceConfig> = {};

      // Parse command line arguments
      if (args.includes('--retention-days')) {
        const index = args.indexOf('--retention-days');
        config.retentionDays = parseInt(args[index + 1]) || 30;
      }

      const result = await cleanup.runCleanupTasks(config);

      console.log('File system cleanup completed:');
      console.log(`- Success: ${result.success}`);
      console.log(`- Duration: ${Math.round(result.duration / 1000)} seconds`);
      console.log(`- Files processed: ${result.itemsProcessed}`);
      console.log(`- Files removed: ${result.itemsRemoved}`);
      console.log(`- Space saved: ${Math.round(result.spaceSaved / 1024 / 1024)} MB`);

      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(error => console.log(`- ${error}`));
      }

      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach(warning => console.log(`- ${warning}`));
      }

      process.exit(result.success ? 0 : 1);

    } catch (error) {
      console.error('File system cleanup failed:', error);
      process.exit(1);
    }
  }
}

// Export for use as module
export { FileSystemCleanup };

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}