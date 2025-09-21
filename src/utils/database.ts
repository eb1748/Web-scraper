import { PrismaClient } from '@prisma/client';
import config from '../config/config';
import { systemLogger } from './logger';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private prisma: PrismaClient;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private readonly maxRetries: number = 5;
  private readonly retryDelay: number = 5000;

  private constructor() {
    this.prisma = new PrismaClient({
      log: config.database.logQueries
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : ['error'],
      datasources: {
        db: {
          url: config.database.url,
        },
      },
    });

    // Set up Prisma event listeners
    this.setupEventListeners();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Get Prisma client
   */
  getClient(): PrismaClient {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  /**
   * Connect to database with retry logic
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      systemLogger.warn('Database already connected');
      return;
    }

    systemLogger.info('Connecting to database...');

    while (this.connectionRetries < this.maxRetries) {
      try {
        await this.prisma.$connect();
        this.isConnected = true;
        this.connectionRetries = 0;
        systemLogger.info('Database connected successfully');

        // Test connection with a simple query
        await this.testConnection();
        return;
      } catch (error) {
        this.connectionRetries++;
        systemLogger.error(
          `Database connection failed (attempt ${this.connectionRetries}/${this.maxRetries})`,
          error,
        );

        if (this.connectionRetries >= this.maxRetries) {
          throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
        }

        systemLogger.info(`Retrying database connection in ${this.retryDelay / 1000} seconds...`);
        await this.delay(this.retryDelay);
      }
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      systemLogger.warn('Database already disconnected');
      return;
    }

    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      systemLogger.info('Database disconnected successfully');
    } catch (error) {
      systemLogger.error('Error disconnecting from database', error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      systemLogger.debug('Database connection test successful');
    } catch (error) {
      systemLogger.error('Database connection test failed', error);
      throw error;
    }
  }

  /**
   * Setup Prisma event listeners
   */
  private setupEventListeners(): void {
    if (config.database.logQueries) {
      // @ts-ignore - Prisma types don't expose $on properly
      this.prisma.$on('query', (e: any) => {
        systemLogger.debug(`Query: ${e.query}`, {
          duration: e.duration,
          params: e.params,
        });
      });
    }

    // @ts-ignore
    this.prisma.$on('error', (e: any) => {
      systemLogger.error('Prisma error', e);
    });

    // @ts-ignore
    this.prisma.$on('warn', (e: any) => {
      systemLogger.warn('Prisma warning', e);
    });
  }

  /**
   * Execute transaction with retry logic
   */
  async executeTransaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
    retries: number = 3,
  ): Promise<T> {
    let attempts = 0;

    while (attempts < retries) {
      try {
        return await this.prisma.$transaction(fn);
      } catch (error) {
        attempts++;
        systemLogger.error(
          `Transaction failed (attempt ${attempts}/${retries})`,
          error,
        );

        if (attempts >= retries) {
          throw error;
        }

        await this.delay(1000 * attempts); // Exponential backoff
      }
    }

    throw new Error(`Transaction failed after ${retries} attempts`);
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<DatabaseHealth> {
    const health: DatabaseHealth = {
      connected: this.isConnected,
      latency: 0,
      tableCount: 0,
      recordCounts: {},
    };

    if (!this.isConnected) {
      return health;
    }

    try {
      // Measure latency
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      health.latency = Date.now() - startTime;

      // Get record counts for main tables
      health.recordCounts = {
        courses: await this.prisma.course.count(),
        reviews: await this.prisma.review.count(),
        qualityReports: await this.prisma.qualityReport.count(),
        scrapingLogs: await this.prisma.scrapingLog.count(),
      };

      // Get table count
      const tables = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      `;
      health.tableCount = Number(tables[0]?.count || 0);

      return health;
    } catch (error) {
      systemLogger.error('Failed to get database health status', error);
      return health;
    }
  }

  /**
   * Run database maintenance tasks
   */
  async runMaintenance(): Promise<void> {
    systemLogger.info('Running database maintenance tasks');

    try {
      // Analyze tables for query optimization
      await this.prisma.$executeRaw`ANALYZE`;

      // Clean up old logs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedLogs = await this.prisma.scrapingLog.deleteMany({
        where: {
          timestamp: {
            lt: thirtyDaysAgo,
          },
        },
      });

      systemLogger.info(`Deleted ${deletedLogs.count} old scraping logs`);

      // Archive old quality reports
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const oldReportsCount = await this.prisma.qualityReport.count({
        where: {
          createdAt: {
            lt: sixtyDaysAgo,
          },
        },
      });

      if (oldReportsCount > 0) {
        systemLogger.info(`Found ${oldReportsCount} old quality reports to archive`);
        // Archive logic would go here
      }

      systemLogger.info('Database maintenance completed successfully');
    } catch (error) {
      systemLogger.error('Database maintenance failed', error);
      throw error;
    }
  }

  /**
   * Backup database schema
   */
  async backupSchema(): Promise<string> {
    try {
      const schema = await this.prisma.$queryRaw<any[]>`
        SELECT
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `;

      const backup = {
        timestamp: new Date().toISOString(),
        schema: schema,
      };

      systemLogger.info('Database schema backup created');
      return JSON.stringify(backup, null, 2);
    } catch (error) {
      systemLogger.error('Failed to backup database schema', error);
      throw error;
    }
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface DatabaseHealth {
  connected: boolean;
  latency: number;
  tableCount: number;
  recordCounts: {
    courses?: number;
    reviews?: number;
    qualityReports?: number;
    scrapingLogs?: number;
  };
}

// Export singleton instance
export const db = DatabaseManager.getInstance();

// Export Prisma client getter for convenience
export function getPrisma(): PrismaClient {
  return db.getClient();
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  systemLogger.info('SIGTERM signal received: closing database connection');
  await db.disconnect();
});

process.on('SIGINT', async () => {
  systemLogger.info('SIGINT signal received: closing database connection');
  await db.disconnect();
});