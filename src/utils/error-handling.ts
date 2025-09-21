import logger from './logger';

/**
 * Enhanced Error Handling Utilities
 *
 * Provides standardized error handling, retry mechanisms, and circuit breaker patterns
 * for the golf course platform with comprehensive logging and monitoring.
 */

// Extended error types for better error categorization
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public service?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends Error {
  constructor(
    message: string,
    public timeoutMs?: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class CourseNotFoundError extends Error {
  constructor(
    message: string,
    public courseId?: string,
    public searchCriteria?: Record<string, any>
  ) {
    super(message);
    this.name = 'CourseNotFoundError';
  }
}

// Retry configuration interface
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: (error: Error) => {
    // Retry on network errors, timeouts, and server errors
    return (
      error instanceof TimeoutError ||
      error instanceof APIError ||
      (error.message && (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout')
      ))
    );
  }
};

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (
        attempt === finalConfig.maxAttempts ||
        !finalConfig.retryCondition?.(lastError)
      ) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
        finalConfig.maxDelay
      );

      logger.warn('Operation failed, retrying', {
        attempt,
        maxAttempts: finalConfig.maxAttempts,
        delay,
        error: lastError.message,
        errorType: lastError.constructor.name
      });

      // Call retry callback
      finalConfig.onRetry?.(attempt, lastError);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000, // 1 minute
    private name: string = 'CircuitBreaker'
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          circuitBreaker: this.name
        });
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    try {
      const result = await operation();

      // Success - reset if in half-open state
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.error('Circuit breaker opened due to failures', {
        circuitBreaker: this.name,
        failures: this.failures,
        threshold: this.failureThreshold
      });
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    logger.info('Circuit breaker reset to CLOSED', {
      circuitBreaker: this.name
    });
  }

  getState(): { state: string; failures: number } {
    return {
      state: this.state,
      failures: this.failures
    };
  }
}

/**
 * Timeout wrapper for operations
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(
        errorMessage || `Operation timed out after ${timeoutMs}ms`,
        timeoutMs
      ));
    }, timeoutMs);

    operation()
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Safe async wrapper that never throws
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<{ data?: T; error?: Error; success: boolean }> {
  try {
    const data = await operation();
    return { data, success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Safe async operation failed', {
      error: err.message,
      errorType: err.constructor.name
    });

    return {
      error: err,
      success: false,
      data: fallback
    };
  }
}

/**
 * Error categorization utility
 */
export function categorizeError(error: Error): {
  category: 'network' | 'api' | 'validation' | 'timeout' | 'rate_limit' | 'not_found' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
} {
  if (error instanceof CourseNotFoundError) {
    return { category: 'not_found', severity: 'medium', retryable: false };
  }

  if (error instanceof ValidationError) {
    return { category: 'validation', severity: 'medium', retryable: false };
  }

  if (error instanceof TimeoutError) {
    return { category: 'timeout', severity: 'medium', retryable: true };
  }

  if (error instanceof RateLimitError) {
    return { category: 'rate_limit', severity: 'low', retryable: true };
  }

  if (error instanceof APIError) {
    const severity = error.statusCode && error.statusCode >= 500 ? 'high' : 'medium';
    const retryable = error.statusCode !== 400 && error.statusCode !== 401 && error.statusCode !== 403;
    return { category: 'api', severity, retryable };
  }

  // Network-related errors
  if (
    error.message.includes('ECONNRESET') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('network')
  ) {
    return { category: 'network', severity: 'medium', retryable: true };
  }

  return { category: 'unknown', severity: 'high', retryable: false };
}

/**
 * Error reporting utility with context
 */
export function reportError(
  error: Error,
  context: Record<string, any> = {},
  source?: string
): void {
  const errorInfo = categorizeError(error);

  logger.error('Error reported', {
    error: error.message,
    errorType: error.constructor.name,
    stack: error.stack,
    category: errorInfo.category,
    severity: errorInfo.severity,
    retryable: errorInfo.retryable,
    source,
    context,
    timestamp: new Date().toISOString()
  });

  // In production, you might want to send to external error tracking
  if (process.env.NODE_ENV === 'production' && errorInfo.severity === 'critical') {
    // Example: Send to Sentry, DataDog, etc.
    // errorTracker.captureException(error, { extra: context });
  }
}

/**
 * Graceful degradation utility
 */
export class GracefulDegradation {
  private static fallbacks = new Map<string, any>();

  static setFallback(key: string, value: any): void {
    this.fallbacks.set(key, value);
  }

  static async executeWithFallback<T>(
    key: string,
    operation: () => Promise<T>,
    fallback?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      logger.warn('Operation failed, using fallback', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });

      const storedFallback = this.fallbacks.get(key);
      if (storedFallback !== undefined) {
        return storedFallback;
      }

      if (fallback !== undefined) {
        return fallback;
      }

      throw error;
    }
  }
}

/**
 * Health check utility for services
 */
export class HealthChecker {
  private checks = new Map<string, () => Promise<boolean>>();

  addCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.checks.set(name, checkFn);
  }

  async runAllChecks(): Promise<{
    healthy: boolean;
    checks: Record<string, { status: 'pass' | 'fail'; error?: string }>;
  }> {
    const results: Record<string, { status: 'pass' | 'fail'; error?: string }> = {};
    let allHealthy = true;

    for (const [name, checkFn] of this.checks) {
      try {
        const isHealthy = await withTimeout(checkFn, 5000, `Health check timeout for ${name}`);
        results[name] = { status: isHealthy ? 'pass' : 'fail' };
        if (!isHealthy) allHealthy = false;
      } catch (error) {
        results[name] = {
          status: 'fail',
          error: error instanceof Error ? error.message : String(error)
        };
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, checks: results };
  }
}

// Global instances
export const weatherServiceCircuitBreaker = new CircuitBreaker(3, 30000, 'WeatherService');
export const osmServiceCircuitBreaker = new CircuitBreaker(3, 30000, 'OSMService');
export const healthChecker = new HealthChecker();

// Initialize fallbacks for common data
GracefulDegradation.setFallback('weather', {
  temperature: 72,
  description: 'Pleasant conditions',
  windSpeed: 5
});

GracefulDegradation.setFallback('nearbyAmenities', []);