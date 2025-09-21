import type {
  ScrapingRequest,
  ScrapingOptions,
  ScrapingTarget,
  ProcessingResult,
  RateLimitInfo,
  QueueStats,
  ScrapingStats,
} from '../../types/scraping.types';
import { StaticContentScraper } from './static-scraper';
import { DynamicContentScraper } from './dynamic-scraper';
import { RobotsChecker } from './robots-checker';
import { scrapingLogger } from '../../utils/logger';
import { retryWithBackoff, CircuitBreaker } from '../../utils/errors';
import config from '../../config/config';

interface QueuedRequest extends ScrapingRequest {
  resolve: (result: ProcessingResult) => void;
  reject: (error: Error) => void;
}

export class RequestManager {
  private requestQueue: QueuedRequest[] = [];
  private processing: Map<string, QueuedRequest> = new Map();
  private rateLimiters: Map<string, RateLimitInfo> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private staticScraper: StaticContentScraper;
  private dynamicScraper: DynamicContentScraper;
  private robotsChecker: RobotsChecker;

  private isProcessing: boolean = false;
  private stats: ScrapingStats;
  private readonly maxConcurrent: number;
  private readonly defaultDelay: number;

  constructor() {
    this.staticScraper = new StaticContentScraper();
    this.dynamicScraper = new DynamicContentScraper();
    this.robotsChecker = new RobotsChecker();

    this.maxConcurrent = config.scraping.maxConcurrentRequests;
    this.defaultDelay = config.scraping.requestDelayMs;

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsPerMinute: 0,
      errorsByType: {},
      domainStats: {},
      queueStats: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalProcessed: 0,
        averageProcessingTime: 0,
        successRate: 0,
      },
      browserStats: {
        activeSessions: 0,
        totalSessions: 0,
        avgSessionDuration: 0,
        memoryUsage: 0,
      },
    };

    // Start processing queue
    this.startProcessing();

    // Update stats periodically
    setInterval(() => this.updateStats(), 60000); // Every minute
  }

  /**
   * Add request to queue
   */
  async addRequest(
    target: ScrapingTarget,
    options?: Partial<ScrapingOptions>,
  ): Promise<ProcessingResult> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        target,
        options: {
          timeout: 30000,
          userAgent: config.scraping.userAgent,
          javascript: false,
          followRedirects: true,
          maxRedirects: 5,
          ...options,
        },
        priority: this.calculatePriority(target),
        retryCount: 0,
        maxRetries: config.scraping.retryAttempts,
        createdAt: new Date(),
        resolve,
        reject,
      };

      // Insert request in priority order
      this.insertByPriority(request);

      this.stats.totalRequests++;
      this.updateQueueStats();

      scrapingLogger.info(`Added request to queue: ${target.name}`, {
        requestId: request.id,
        priority: request.priority,
        queueSize: this.requestQueue.length,
      });
    });
  }

  /**
   * Process the request queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    scrapingLogger.info('Starting request queue processing');

    while (true) {
      try {
        // Wait if we're at max concurrent requests
        while (this.processing.size >= this.maxConcurrent) {
          await this.delay(100);
        }

        // Get next request from queue
        const request = this.requestQueue.shift();
        if (!request) {
          await this.delay(1000); // Wait 1 second if queue is empty
          continue;
        }

        // Process request concurrently
        this.processRequest(request);
      } catch (error) {
        scrapingLogger.error('Error in queue processing loop', error);
        await this.delay(5000); // Wait 5 seconds on error
      }
    }
  }

  /**
   * Process individual request
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    const domain = this.extractDomain(request.target.url);

    try {
      // Add to processing map
      this.processing.set(request.id, request);
      this.updateQueueStats();

      scrapingLogger.info(`Processing request: ${request.target.name}`, {
        requestId: request.id,
        attempt: request.retryCount + 1,
        maxRetries: request.maxRetries,
      });

      // Check circuit breaker
      const circuitBreaker = this.getCircuitBreaker(domain);

      // Rate limiting
      await this.respectRateLimit(domain);

      // Robots.txt check
      const robotsResult = await this.robotsChecker.canScrape(
        request.target.url,
        request.options.userAgent!,
      );

      if (!robotsResult.allowed) {
        throw new Error(`Robots.txt disallows scraping: ${robotsResult.reason}`);
      }

      // Apply additional crawl delay from robots.txt
      if (robotsResult.crawlDelay && robotsResult.crawlDelay > this.defaultDelay) {
        await this.delay(robotsResult.crawlDelay - this.defaultDelay);
      }

      // Execute request with circuit breaker
      const result = await circuitBreaker.execute(async () => {
        return await this.executeRequest(request);
      });

      // Update stats
      this.updateDomainStats(domain, true, result.processingTime);
      this.stats.successfulRequests++;

      // Resolve promise
      request.resolve(result);

      scrapingLogger.info(`Request completed successfully: ${request.target.name}`, {
        requestId: request.id,
        processingTime: result.processingTime,
        confidence: result.confidence,
      });
    } catch (error) {
      const shouldRetry = this.shouldRetry(request, error);

      if (shouldRetry && request.retryCount < request.maxRetries) {
        // Retry request
        request.retryCount++;
        request.scheduledAt = new Date(Date.now() + this.calculateRetryDelay(request.retryCount));

        scrapingLogger.warn(`Request failed, scheduling retry: ${request.target.name}`, {
          requestId: request.id,
          attempt: request.retryCount,
          error: error.message,
          retryDelay: this.calculateRetryDelay(request.retryCount),
        });

        // Re-add to queue for retry
        setTimeout(() => {
          this.insertByPriority(request);
        }, this.calculateRetryDelay(request.retryCount));
      } else {
        // Final failure
        this.updateDomainStats(domain, false, 0);
        this.stats.failedRequests++;
        this.updateErrorStats(error);

        scrapingLogger.error(`Request failed permanently: ${request.target.name}`, error, {
          requestId: request.id,
          totalAttempts: request.retryCount + 1,
        });

        request.reject(error);
      }
    } finally {
      // Remove from processing map
      this.processing.delete(request.id);
      this.updateQueueStats();
    }
  }

  /**
   * Execute the actual scraping request
   */
  private async executeRequest(request: QueuedRequest): Promise<ProcessingResult> {
    const useJavaScript = request.options.javascript || this.requiresJavaScript(request.target.url);

    if (useJavaScript) {
      return await this.dynamicScraper.scrapeDynamicSite(request.target, request.options);
    } else {
      return await this.staticScraper.scrapeBasicInfo(request.target, request.options);
    }
  }

  /**
   * Respect rate limiting for domain
   */
  private async respectRateLimit(domain: string): Promise<void> {
    const rateLimiter = this.getRateLimiter(domain);
    const now = Date.now();

    // Reset if minute has passed
    if (now - rateLimiter.lastReset.getTime() > 60000) {
      rateLimiter.currentRequests = 0;
      rateLimiter.lastReset = new Date();
    }

    // Check if we need to wait
    if (rateLimiter.currentRequests >= rateLimiter.requestsPerMinute) {
      const waitTime = 60000 - (now - rateLimiter.lastReset.getTime());
      if (waitTime > 0) {
        scrapingLogger.debug(`Rate limit reached for ${domain}, waiting ${waitTime}ms`);
        await this.delay(waitTime);

        // Reset after waiting
        rateLimiter.currentRequests = 0;
        rateLimiter.lastReset = new Date();
      }
    }

    // Apply base delay
    await this.delay(this.defaultDelay);

    // Increment request count
    rateLimiter.currentRequests++;
  }

  /**
   * Get or create rate limiter for domain
   */
  private getRateLimiter(domain: string): RateLimitInfo {
    if (!this.rateLimiters.has(domain)) {
      this.rateLimiters.set(domain, {
        domain,
        requestsPerMinute: 30, // Default 30 requests per minute
        requestsPerHour: 1000, // Default 1000 requests per hour
        currentRequests: 0,
        lastReset: new Date(),
        blocked: false,
      });
    }
    return this.rateLimiters.get(domain)!;
  }

  /**
   * Get or create circuit breaker for domain
   */
  private getCircuitBreaker(domain: string): CircuitBreaker {
    if (!this.circuitBreakers.has(domain)) {
      this.circuitBreakers.set(domain, new CircuitBreaker(5, 300000)); // 5 failures, 5 min timeout
    }
    return this.circuitBreakers.get(domain)!;
  }

  /**
   * Calculate request priority
   */
  private calculatePriority(target: ScrapingTarget): number {
    let priority = 5; // Default medium priority

    switch (target.priority) {
      case 'high':
        priority = 8;
        break;
      case 'low':
        priority = 2;
        break;
    }

    // Boost priority for official websites
    if (target.sourceType === 'official') {
      priority += 2;
    }

    return priority;
  }

  /**
   * Insert request in priority order
   */
  private insertByPriority(request: QueuedRequest): void {
    let inserted = false;
    for (let i = 0; i < this.requestQueue.length; i++) {
      if (request.priority > this.requestQueue[i].priority) {
        this.requestQueue.splice(i, 0, request);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.requestQueue.push(request);
    }
  }

  /**
   * Check if request should be retried
   */
  private shouldRetry(request: QueuedRequest, error: any): boolean {
    // Don't retry robots.txt violations
    if (error.message?.includes('robots.txt')) {
      return false;
    }

    // Don't retry 404s
    if (error.statusCode === 404) {
      return false;
    }

    // Don't retry 403s (forbidden)
    if (error.statusCode === 403) {
      return false;
    }

    // Retry network errors and timeouts
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.defaultDelay;
    const backoffFactor = config.scraping.exponentialBackoffBase;
    return Math.min(baseDelay * Math.pow(backoffFactor, attempt), 60000); // Max 1 minute
  }

  /**
   * Check if URL requires JavaScript rendering
   */
  private requiresJavaScript(url: string): boolean {
    const jsPatterns = ['react', 'angular', 'vue', 'spa', 'ajax', 'dynamic'];

    const domain = this.extractDomain(url).toLowerCase();
    return jsPatterns.some((pattern) => domain.includes(pattern));
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}`;
    } catch {
      return url;
    }
  }

  /**
   * Update domain statistics
   */
  private updateDomainStats(domain: string, success: boolean, responseTime: number): void {
    if (!this.stats.domainStats[domain]) {
      this.stats.domainStats[domain] = {
        requests: 0,
        success: 0,
        failures: 0,
        avgResponseTime: 0,
        lastRequest: new Date(),
      };
    }

    const stats = this.stats.domainStats[domain];
    stats.requests++;
    stats.lastRequest = new Date();

    if (success) {
      stats.success++;
      stats.avgResponseTime =
        (stats.avgResponseTime * (stats.success - 1) + responseTime) / stats.success;
    } else {
      stats.failures++;
    }
  }

  /**
   * Update error statistics
   */
  private updateErrorStats(error: any): void {
    const errorType = error.constructor.name || 'Unknown';
    this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
  }

  /**
   * Update queue statistics
   */
  private updateQueueStats(): void {
    this.stats.queueStats.pending = this.requestQueue.length;
    this.stats.queueStats.processing = this.processing.size;
  }

  /**
   * Update overall statistics
   */
  private updateStats(): void {
    // Calculate success rate
    const total = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.queueStats.successRate = total > 0 ? this.stats.successfulRequests / total : 0;

    // Calculate requests per minute
    // This would need a time-window implementation for accuracy
    this.stats.requestsPerMinute = this.stats.totalRequests; // Simplified

    scrapingLogger.debug('Updated scraping statistics', {
      totalRequests: this.stats.totalRequests,
      successRate: this.stats.queueStats.successRate,
      queueSize: this.requestQueue.length,
      processing: this.processing.size,
    });
  }

  /**
   * Get current statistics
   */
  getStats(): ScrapingStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): QueueStats {
    return { ...this.stats.queueStats };
  }

  /**
   * Clear completed requests and reset stats
   */
  reset(): void {
    this.requestQueue.length = 0;
    this.processing.clear();
    this.stats.totalRequests = 0;
    this.stats.successfulRequests = 0;
    this.stats.failedRequests = 0;
    this.stats.errorsByType = {};

    scrapingLogger.info('Request manager reset');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.isProcessing = false;

    // Wait for processing requests to complete
    while (this.processing.size > 0) {
      await this.delay(1000);
    }

    await this.dynamicScraper.cleanup();

    scrapingLogger.info('Request manager cleanup completed');
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
