import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs-extra';
import config from '../config/config';

// Ensure log directory exists
fs.ensureDirSync(config.logging.dir);

// Define custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }),
);

// Create rotating file transport for all logs
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(config.logging.dir, 'app-%DATE%.log'),
  datePattern: config.logging.datePattern,
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  format: logFormat,
});

// Create rotating file transport for errors only
const errorFileRotateTransport = new DailyRotateFile({
  filename: path.join(config.logging.dir, 'error-%DATE%.log'),
  datePattern: config.logging.datePattern,
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  level: 'error',
  format: logFormat,
});

// Create Winston logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    fileRotateTransport,
    errorFileRotateTransport,
  ],
  exitOnError: false,
});

// Add console transport in development
if (config.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  );
}

// Create specialized loggers for different categories
class CategoryLogger {
  constructor(private category: string) {}

  debug(message: string, metadata?: any): void {
    logger.debug(message, { category: this.category, ...metadata });
  }

  info(message: string, metadata?: any): void {
    logger.info(message, { category: this.category, ...metadata });
  }

  warn(message: string, metadata?: any): void {
    logger.warn(message, { category: this.category, ...metadata });
  }

  error(message: string, error?: Error | any, metadata?: any): void {
    const errorData = error instanceof Error
      ? {
          errorMessage: error.message,
          errorStack: error.stack,
          errorName: error.name,
        }
      : error
      ? { error }
      : {};

    logger.error(message, {
      category: this.category,
      ...errorData,
      ...metadata,
    });
  }

  // Special method for logging scraping activities
  logScraping(url: string, status: 'start' | 'success' | 'failure', metadata?: any): void {
    const level = status === 'failure' ? 'error' : 'info';
    logger.log(level, `Scraping ${status}: ${url}`, {
      category: 'scraping',
      url,
      status,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  // Special method for logging API calls
  logAPI(
    service: string,
    endpoint: string,
    status: 'request' | 'response' | 'error',
    metadata?: any,
  ): void {
    const level = status === 'error' ? 'error' : 'debug';
    logger.log(level, `API ${status}: ${service} - ${endpoint}`, {
      category: 'api',
      service,
      endpoint,
      status,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  // Special method for logging validation results
  logValidation(
    courseId: string,
    validationType: string,
    passed: boolean,
    metadata?: any,
  ): void {
    const level = passed ? 'info' : 'warn';
    logger.log(level, `Validation ${passed ? 'passed' : 'failed'}: ${validationType}`, {
      category: 'validation',
      courseId,
      validationType,
      passed,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  // Special method for logging processing activities
  logProcessing(
    processType: string,
    itemId: string,
    status: 'start' | 'progress' | 'complete' | 'error',
    metadata?: any,
  ): void {
    const level = status === 'error' ? 'error' : 'info';
    logger.log(level, `Processing ${status}: ${processType}`, {
      category: 'processing',
      processType,
      itemId,
      status,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }
}

// Export specialized loggers
export const scrapingLogger = new CategoryLogger('scraping');
export const apiLogger = new CategoryLogger('api');
export const validationLogger = new CategoryLogger('validation');
export const processingLogger = new CategoryLogger('processing');
export const systemLogger = new CategoryLogger('system');

// Export the main logger for general use
export default logger;

// Utility function to create a logger for a specific module
export function createLogger(moduleName: string): CategoryLogger {
  return new CategoryLogger(moduleName);
}

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(config.logging.dir, 'exceptions.log'),
  }),
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(config.logging.dir, 'rejections.log'),
  }),
);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing logger');
  logger.end();
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing logger');
  logger.end();
});