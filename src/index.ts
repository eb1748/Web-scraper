import config from './config/config';
import { db } from './utils/database';
import { storageManager } from './utils/storage';
import { systemLogger } from './utils/logger';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    systemLogger.info('Starting Golf Journey Map Scraper');
    systemLogger.info(`Environment: ${config.nodeEnv}`);

    // Initialize storage directories
    await storageManager.initializeStorage();

    // Connect to database
    await db.connect();

    // Check database health
    const health = await db.getHealthStatus();
    systemLogger.info('Database health:', health);

    // Log configuration (without sensitive data)
    systemLogger.info('Configuration loaded', {
      scraping: {
        requestDelayMs: config.scraping.requestDelayMs,
        maxConcurrentRequests: config.scraping.maxConcurrentRequests,
      },
      validation: {
        confidenceThreshold: config.validation.confidenceThreshold,
        qualityScoreThreshold: config.validation.qualityScoreThreshold,
      },
    });

    systemLogger.info('Infrastructure initialization complete');
    systemLogger.info('Ready to start scraping operations');

    // Keep the process alive (in production, this would be replaced with actual server/scheduler)
    if (config.nodeEnv === 'development') {
      systemLogger.info('Running in development mode - keeping process alive');
      setInterval(() => {
        systemLogger.debug('Heartbeat');
      }, 60000); // Log heartbeat every minute
    }

  } catch (error) {
    systemLogger.error('Failed to start application', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  systemLogger.info('SIGTERM received, shutting down gracefully');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  systemLogger.info('SIGINT received, shutting down gracefully');
  await db.disconnect();
  process.exit(0);
});

// Start the application
main().catch((error) => {
  systemLogger.error('Unhandled error in main:', error);
  process.exit(1);
});