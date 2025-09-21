import * as fs from 'fs-extra';
import * as path from 'path';
import config from '../config/config';
import { systemLogger } from './logger';

export class StorageManager {
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.cwd();
  }

  /**
   * Initialize all required storage directories
   */
  async initializeStorage(): Promise<void> {
    systemLogger.info('Initializing storage directories');

    const directories = [
      // Data directories
      config.storage.dataDir,
      path.join(config.storage.dataDir, 'images'),
      path.join(config.storage.dataDir, 'images', 'courses'),
      path.join(config.storage.tempDir),
      path.join(config.storage.tempDir, 'downloads'),
      path.join(config.storage.tempDir, 'processing'),
      path.join(config.storage.exportDir),
      path.join(config.storage.exportDir, 'csv'),
      path.join(config.storage.exportDir, 'json'),

      // Media directories
      config.storage.mediaDir,
      path.join(config.storage.mediaDir, 'courses'),

      // Log directory
      config.storage.logsDir,
    ];

    for (const dir of directories) {
      await this.ensureDirectory(dir);
    }

    // Create .gitkeep files to preserve empty directories
    await this.createGitKeepFiles();

    systemLogger.info('Storage directories initialized successfully');
  }

  /**
   * Ensure a directory exists, create if it doesn't
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(this.baseDir, dirPath);

    try {
      await fs.ensureDir(fullPath);
      systemLogger.debug(`Directory ensured: ${fullPath}`);
    } catch (error) {
      systemLogger.error(`Failed to create directory: ${fullPath}`, error);
      throw error;
    }
  }

  /**
   * Create .gitkeep files in empty directories
   */
  private async createGitKeepFiles(): Promise<void> {
    const gitKeepDirs = [
      path.join(config.storage.dataDir, '.gitkeep'),
      path.join(config.storage.mediaDir, '.gitkeep'),
      path.join(config.storage.tempDir, '.gitkeep'),
      path.join(config.storage.exportDir, '.gitkeep'),
    ];

    for (const filePath of gitKeepDirs) {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath);
      try {
        await fs.ensureFile(fullPath);
      } catch (error) {
        systemLogger.warn(`Failed to create .gitkeep: ${fullPath}`, error);
      }
    }
  }

  /**
   * Get course-specific media directory
   */
  getCourseMediaDir(courseId: string): string {
    return path.join(config.storage.mediaDir, 'courses', courseId);
  }

  /**
   * Ensure course-specific directories exist
   */
  async ensureCourseDirectories(courseId: string): Promise<void> {
    const courseMediaDir = this.getCourseMediaDir(courseId);

    const directories = [
      courseMediaDir,
      path.join(courseMediaDir, 'original'),
      path.join(courseMediaDir, 'optimized'),
      path.join(courseMediaDir, 'optimized', 'hero'),
      path.join(courseMediaDir, 'optimized', 'gallery'),
      path.join(courseMediaDir, 'optimized', 'maps'),
      path.join(courseMediaDir, 'thumbnails'),
    ];

    for (const dir of directories) {
      await this.ensureDirectory(dir);
    }

    // Create metadata.json template
    const metadataPath = path.join(courseMediaDir, 'metadata.json');
    if (!(await fs.pathExists(metadataPath))) {
      await fs.writeJson(
        metadataPath,
        {
          courseId,
          createdAt: new Date().toISOString(),
          images: {
            hero: [],
            gallery: [],
            maps: [],
            amenities: [],
          },
          totalImages: 0,
          totalSizeMB: 0,
          lastUpdated: new Date().toISOString(),
        },
        { spaces: 2 },
      );
    }
  }

  /**
   * Clean temporary files older than specified days
   */
  async cleanTempFiles(daysOld: number = 7): Promise<void> {
    systemLogger.info(`Cleaning temporary files older than ${daysOld} days`);

    const tempDir = path.join(this.baseDir, config.storage.tempDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      const files = await fs.readdir(tempDir);
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.remove(filePath);
          cleanedCount++;
          systemLogger.debug(`Removed old temp file: ${file}`);
        }
      }

      systemLogger.info(`Cleaned ${cleanedCount} temporary files`);
    } catch (error) {
      systemLogger.error('Failed to clean temporary files', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    const stats: StorageStats = {
      dataDir: await this.getDirectorySize(config.storage.dataDir),
      mediaDir: await this.getDirectorySize(config.storage.mediaDir),
      tempDir: await this.getDirectorySize(config.storage.tempDir),
      exportDir: await this.getDirectorySize(config.storage.exportDir),
      logsDir: await this.getDirectorySize(config.storage.logsDir),
      totalSize: 0,
    };

    stats.totalSize =
      stats.dataDir + stats.mediaDir + stats.tempDir + stats.exportDir + stats.logsDir;

    return stats;
  }

  /**
   * Get directory size in bytes
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(this.baseDir, dirPath);

    if (!(await fs.pathExists(fullPath))) {
      return 0;
    }

    let size = 0;
    const files = await fs.readdir(fullPath);

    for (const file of files) {
      const filePath = path.join(fullPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        size += await this.getDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    }

    return size;
  }

  /**
   * Archive old export files
   */
  async archiveExports(daysOld: number = 30): Promise<void> {
    systemLogger.info(`Archiving export files older than ${daysOld} days`);

    const exportDir = path.join(this.baseDir, config.storage.exportDir);
    const archiveDir = path.join(exportDir, 'archive');
    await this.ensureDirectory(archiveDir);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      const subdirs = ['csv', 'json'];
      let archivedCount = 0;

      for (const subdir of subdirs) {
        const dirPath = path.join(exportDir, subdir);
        if (!(await fs.pathExists(dirPath))) continue;

        const files = await fs.readdir(dirPath);

        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate && stats.isFile()) {
            const archivePath = path.join(archiveDir, subdir);
            await this.ensureDirectory(archivePath);
            await fs.move(filePath, path.join(archivePath, file), { overwrite: true });
            archivedCount++;
            systemLogger.debug(`Archived export file: ${file}`);
          }
        }
      }

      systemLogger.info(`Archived ${archivedCount} export files`);
    } catch (error) {
      systemLogger.error('Failed to archive export files', error);
      throw error;
    }
  }
}

interface StorageStats {
  dataDir: number;
  mediaDir: number;
  tempDir: number;
  exportDir: number;
  logsDir: number;
  totalSize: number;
}

// Export singleton instance
export const storageManager = new StorageManager();

// Initialize storage on module load in development
if (config.nodeEnv === 'development') {
  storageManager.initializeStorage().catch((error) => {
    systemLogger.error('Failed to initialize storage on module load', error);
  });
}
