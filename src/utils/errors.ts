import { systemLogger } from './logger';

/**
 * Base error class for all custom errors
 */
export abstract class BaseError extends Error {
  public readonly isOperational: boolean;
  public readonly statusCode: number;
  public readonly timestamp: Date;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Network/HTTP related errors
 */
export class NetworkError extends BaseError {
  public readonly url?: string;
  public readonly method?: string;
  public readonly responseStatus?: number;

  constructor(message: string, url?: string, method?: string, responseStatus?: number) {
    super(message, 502, true);
    this.url = url;
    this.method = method;
    this.responseStatus = responseStatus;
  }
}

/**
 * HTML/Data parsing errors
 */
export class ParseError extends BaseError {
  public readonly source?: string;
  public readonly field?: string;

  constructor(message: string, source?: string, field?: string) {
    super(message, 422, true);
    this.source = source;
    this.field = field;
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends BaseError {
  public readonly service: string;
  public readonly retryAfter?: number;

  constructor(service: string, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${service}${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      429,
      true,
    );
    this.service = service;
    this.retryAfter = retryAfter;
  }
}

/**
 * Data validation errors
 */
export class ValidationError extends BaseError {
  public readonly validationErrors: ValidationErrorDetail[];

  constructor(message: string, validationErrors: ValidationErrorDetail[]) {
    super(message, 400, true);
    this.validationErrors = validationErrors;
  }
}

export interface ValidationErrorDetail {
  field: string;
  value?: any;
  constraint: string;
  message: string;
}

/**
 * Database errors
 */
export class DatabaseError extends BaseError {
  public readonly query?: string;
  public readonly code?: string;

  constructor(message: string, query?: string, code?: string) {
    super(message, 500, false);
    this.query = query;
    this.code = code;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends BaseError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string) {
    super(message, 500, false);
    this.configKey = configKey;
  }
}

/**
 * File system errors
 */
export class FileSystemError extends BaseError {
  public readonly path?: string;
  public readonly operation?: string;

  constructor(message: string, path?: string, operation?: string) {
    super(message, 500, true);
    this.path = path;
    this.operation = operation;
  }
}

/**
 * Scraping-specific errors
 */
export class ScrapingError extends BaseError {
  public readonly courseId?: string;
  public readonly url?: string;
  public readonly step?: string;

  constructor(message: string, courseId?: string, url?: string, step?: string) {
    super(message, 500, true);
    this.courseId = courseId;
    this.url = url;
    this.step = step;
  }
}

/**
 * API errors
 */
export class APIError extends BaseError {
  public readonly api: string;
  public readonly endpoint?: string;
  public readonly responseData?: any;

  constructor(api: string, message: string, endpoint?: string, responseData?: any) {
    super(message, 502, true);
    this.api = api;
    this.endpoint = endpoint;
    this.responseData = responseData;
  }
}

/**
 * Processing errors
 */
export class ProcessingError extends BaseError {
  public readonly processType: string;
  public readonly itemId?: string;
  public readonly stage?: string;

  constructor(processType: string, message: string, itemId?: string, stage?: string) {
    super(message, 500, true);
    this.processType = processType;
    this.itemId = itemId;
    this.stage = stage;
  }
}

/**
 * Global error handler
 */
export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log errors appropriately
   */
  handle(error: Error | BaseError): void {
    if (this.isOperationalError(error)) {
      this.handleOperationalError(error as BaseError);
    } else {
      this.handleProgrammerError(error);
    }
  }

  /**
   * Check if error is operational (expected)
   */
  private isOperationalError(error: Error): boolean {
    return error instanceof BaseError && error.isOperational;
  }

  /**
   * Handle operational errors (expected errors)
   */
  private handleOperationalError(error: BaseError): void {
    systemLogger.error(`Operational error: ${error.message}`, {
      name: error.name,
      statusCode: error.statusCode,
      ...error,
    });

    // Additional handling based on error type
    if (error instanceof RateLimitError && error.retryAfter) {
      systemLogger.info(`Will retry after ${error.retryAfter} seconds`);
    }

    if (error instanceof ValidationError) {
      systemLogger.debug('Validation errors:', error.validationErrors);
    }
  }

  /**
   * Handle programmer errors (unexpected errors)
   */
  private handleProgrammerError(error: Error): void {
    systemLogger.error(`Programmer error: ${error.message}`, {
      name: error.name,
      stack: error.stack,
    });

    // In production, we might want to restart the process
    if (process.env.NODE_ENV === 'production') {
      systemLogger.error('Programmer error detected. Process will exit.');
      process.exit(1);
    }
  }

  /**
   * Async error wrapper for route handlers
   */
  asyncWrapper<T>(fn: (...args: any[]) => Promise<T>) {
    return async (...args: any[]): Promise<T> => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error as Error);
        throw error;
      }
    };
  }

  /**
   * Convert any error to BaseError
   */
  normalize(error: any): BaseError {
    if (error instanceof BaseError) {
      return error;
    }

    if (error instanceof Error) {
      return new BaseError(error.message, 500, false);
    }

    return new BaseError(
      typeof error === 'string' ? error : 'An unknown error occurred',
      500,
      false,
    );
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

/**
 * Retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000, maxDelay = 30000, factor = 2, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(factor, attempt - 1), maxDelay);

      if (onRetry) {
        onRetry(attempt, delay, lastError);
      }

      systemLogger.debug(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`, {
        error: lastError.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  factor?: number;
  onRetry?: (attempt: number, delay: number, error: Error) => void;
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      systemLogger.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.timeout;
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = undefined;
  }
}

// Set up global error handlers
process.on('uncaughtException', (error: Error) => {
  systemLogger.error('Uncaught exception:', error);
  errorHandler.handle(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  systemLogger.error('Unhandled rejection:', reason);
  errorHandler.handle(new BaseError(reason?.message || 'Unhandled promise rejection', 500, false));
  process.exit(1);
});
