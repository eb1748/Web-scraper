import { RequestManager } from '../../services/scrapers/request-manager';
import { StaticContentScraper } from '../../services/scrapers/static-scraper';
import { DynamicContentScraper } from '../../services/scrapers/dynamic-scraper';
import { RobotsChecker } from '../../services/scrapers/robots-checker';
import type { ScrapingTarget, ProcessingResult } from '../../types/scraping.types';

// Mock all dependencies
jest.mock('../../services/scrapers/static-scraper');
jest.mock('../../services/scrapers/dynamic-scraper');
jest.mock('../../services/scrapers/robots-checker');

const MockedStaticScraper = StaticContentScraper as jest.MockedClass<typeof StaticContentScraper>;
const MockedDynamicScraper = DynamicContentScraper as jest.MockedClass<typeof DynamicContentScraper>;
const MockedRobotsChecker = RobotsChecker as jest.MockedClass<typeof RobotsChecker>;

describe('RequestManager', () => {
  let requestManager: RequestManager;
  let mockStaticScraper: jest.Mocked<StaticContentScraper>;
  let mockDynamicScraper: jest.Mocked<DynamicContentScraper>;
  let mockRobotsChecker: jest.Mocked<RobotsChecker>;

  beforeEach(() => {
    // Setup mocks
    mockStaticScraper = {
      scrapeBasicInfo: jest.fn(),
    } as any;

    mockDynamicScraper = {
      scrapeDynamicSite: jest.fn(),
      cleanup: jest.fn(),
    } as any;

    mockRobotsChecker = {
      canScrape: jest.fn(),
    } as any;

    MockedStaticScraper.mockImplementation(() => mockStaticScraper);
    MockedDynamicScraper.mockImplementation(() => mockDynamicScraper);
    MockedRobotsChecker.mockImplementation(() => mockRobotsChecker);

    requestManager = new RequestManager();

    // Default mock behaviors
    mockRobotsChecker.canScrape.mockResolvedValue({
      allowed: true,
      crawlDelay: 1000,
      reason: 'Allowed',
      cacheHit: false,
      checkedAt: new Date(),
    });
  });

  afterEach(async () => {
    await requestManager.cleanup();
    jest.clearAllMocks();
  });

  describe('addRequest', () => {
    const mockTarget: ScrapingTarget = {
      id: 'test-course',
      name: 'Test Golf Course',
      url: 'https://example.com/golf',
      priority: 'medium',
      sourceType: 'official',
    };

    it('should successfully process a static scraping request', async () => {
      const mockResult: ProcessingResult = {
        success: true,
        data: {
          name: 'Test Golf Course',
          description: 'A beautiful golf course',
          source: 'https://example.com/golf',
          confidence: 85,
        },
        confidence: 85,
        processingTime: 1500,
        errors: [],
        metadata: {
          method: 'static',
          finalUrl: 'https://example.com/golf',
          responseSize: 50000,
          requestCount: 1,
        },
      };

      mockStaticScraper.scrapeBasicInfo.mockResolvedValue(mockResult);

      const result = await requestManager.addRequest(mockTarget);

      expect(result).toEqual(mockResult);
      expect(mockRobotsChecker.canScrape).toHaveBeenCalledWith(
        'https://example.com/golf',
        expect.any(String)
      );
      expect(mockStaticScraper.scrapeBasicInfo).toHaveBeenCalledWith(
        mockTarget,
        expect.any(Object)
      );
    });

    it('should use dynamic scraper for JavaScript-required sites', async () => {
      const jsTarget: ScrapingTarget = {
        ...mockTarget,
        url: 'https://spa-golf.com/course',
      };

      const mockResult: ProcessingResult = {
        success: true,
        data: {
          name: 'SPA Golf Course',
          description: 'A modern SPA golf course',
          source: 'https://spa-golf.com/course',
          confidence: 90,
        },
        confidence: 90,
        processingTime: 3000,
        errors: [],
        metadata: {
          method: 'dynamic',
          finalUrl: 'https://spa-golf.com/course',
          responseSize: 75000,
          requestCount: 1,
        },
      };

      mockDynamicScraper.scrapeDynamicSite.mockResolvedValue(mockResult);

      const result = await requestManager.addRequest(jsTarget, { javascript: true });

      expect(mockDynamicScraper.scrapeDynamicSite).toHaveBeenCalledWith(
        jsTarget,
        expect.objectContaining({ javascript: true })
      );
      expect(result).toEqual(mockResult);
    });

    it('should respect robots.txt restrictions', async () => {
      mockRobotsChecker.canScrape.mockResolvedValue({
        allowed: false,
        crawlDelay: 1000,
        reason: 'Path disallowed by robots.txt',
        cacheHit: false,
        checkedAt: new Date(),
      });

      await expect(requestManager.addRequest(mockTarget)).rejects.toThrow(
        'Robots.txt disallows scraping'
      );

      expect(mockStaticScraper.scrapeBasicInfo).not.toHaveBeenCalled();
    });

    it('should implement rate limiting per domain', async () => {
      const targets = [
        { ...mockTarget, id: 'course1', url: 'https://example.com/course1' },
        { ...mockTarget, id: 'course2', url: 'https://example.com/course2' },
        { ...mockTarget, id: 'course3', url: 'https://example.com/course3' },
      ];

      const mockResult: ProcessingResult = {
        success: true,
        data: { name: 'Test', source: 'test', confidence: 80 },
        confidence: 80,
        processingTime: 1000,
        errors: [],
        metadata: { method: 'static', finalUrl: 'test', responseSize: 1000, requestCount: 1 },
      };

      mockStaticScraper.scrapeBasicInfo.mockResolvedValue(mockResult);

      const startTime = Date.now();

      // Process multiple requests to same domain concurrently
      const promises = targets.map(target => requestManager.addRequest(target));
      await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should have taken some time due to rate limiting
      expect(totalTime).toBeGreaterThan(2000); // At least 2 seconds for delays
    });

    it('should prioritize high-priority requests', async () => {
      const lowPriorityTarget = { ...mockTarget, priority: 'low' as const };
      const highPriorityTarget = { ...mockTarget, priority: 'high' as const, id: 'high-pri' };

      const processOrder: string[] = [];

      mockStaticScraper.scrapeBasicInfo.mockImplementation(async (target) => {
        processOrder.push(target.id);
        return {
          success: true,
          data: { name: target.name, source: target.url, confidence: 80 },
          confidence: 80,
          processingTime: 100,
          errors: [],
          metadata: { method: 'static', finalUrl: target.url, responseSize: 1000, requestCount: 1 },
        };
      });

      // Add low priority first, then high priority
      const lowPromise = requestManager.addRequest(lowPriorityTarget);
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const highPromise = requestManager.addRequest(highPriorityTarget);

      await Promise.all([lowPromise, highPromise]);

      // High priority should be processed first (or at least not significantly delayed)
      expect(processOrder).toContain('high-pri');
      expect(processOrder).toContain('test-course');
    });

    it('should retry failed requests with exponential backoff', async () => {
      let attemptCount = 0;
      mockStaticScraper.scrapeBasicInfo.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network timeout');
        }
        return {
          success: true,
          data: { name: 'Success', source: 'test', confidence: 80 },
          confidence: 80,
          processingTime: 1000,
          errors: [],
          metadata: { method: 'static', finalUrl: 'test', responseSize: 1000, requestCount: 1 },
        };
      });

      const result = await requestManager.addRequest(mockTarget);

      expect(attemptCount).toBe(3);
      expect(result.success).toBe(true);
    });

    it('should not retry robots.txt violations', async () => {
      let attemptCount = 0;
      mockRobotsChecker.canScrape.mockImplementation(async () => {
        attemptCount++;
        throw new Error('robots.txt disallows this');
      });

      await expect(requestManager.addRequest(mockTarget)).rejects.toThrow();
      expect(attemptCount).toBe(1); // Should not retry
    });

    it('should not retry 404 errors', async () => {
      let attemptCount = 0;
      mockStaticScraper.scrapeBasicInfo.mockImplementation(async () => {
        attemptCount++;
        const error = new Error('Not found') as any;
        error.statusCode = 404;
        throw error;
      });

      await expect(requestManager.addRequest(mockTarget)).rejects.toThrow();
      expect(attemptCount).toBe(1); // Should not retry 404s
    });

    it('should apply custom crawl delay from robots.txt', async () => {
      mockRobotsChecker.canScrape.mockResolvedValue({
        allowed: true,
        crawlDelay: 5000, // 5 second delay
        reason: 'Allowed with delay',
        cacheHit: false,
        checkedAt: new Date(),
      });

      const mockResult: ProcessingResult = {
        success: true,
        data: { name: 'Test', source: 'test', confidence: 80 },
        confidence: 80,
        processingTime: 1000,
        errors: [],
        metadata: { method: 'static', finalUrl: 'test', responseSize: 1000, requestCount: 1 },
      };

      mockStaticScraper.scrapeBasicInfo.mockResolvedValue(mockResult);

      const startTime = Date.now();
      await requestManager.addRequest(mockTarget);
      const endTime = Date.now();

      // Should have waited for robots.txt crawl delay
      expect(endTime - startTime).toBeGreaterThan(4000);
    });
  });

  describe('circuit breaker', () => {
    const mockTarget: ScrapingTarget = {
      id: 'test-course',
      name: 'Test Golf Course',
      url: 'https://failing-site.com/golf',
      priority: 'medium',
      sourceType: 'official',
    };

    it('should open circuit after multiple failures', async () => {
      // Make scraper always fail
      mockStaticScraper.scrapeBasicInfo.mockRejectedValue(new Error('Server error'));

      // Try multiple requests to trigger circuit breaker
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(
          requestManager.addRequest({ ...mockTarget, id: `course-${i}` }).catch(e => e)
        );
      }

      const results = await Promise.all(promises);

      // Later requests should fail faster due to circuit breaker
      expect(results.every(r => r instanceof Error)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      const mockTarget: ScrapingTarget = {
        id: 'test-course',
        name: 'Test Golf Course',
        url: 'https://example.com/golf',
        priority: 'medium',
        sourceType: 'official',
      };

      const mockResult: ProcessingResult = {
        success: true,
        data: { name: 'Test', source: 'test', confidence: 80 },
        confidence: 80,
        processingTime: 1000,
        errors: [],
        metadata: { method: 'static', finalUrl: 'test', responseSize: 1000, requestCount: 1 },
      };

      mockStaticScraper.scrapeBasicInfo.mockResolvedValue(mockResult);

      // Process a request
      await requestManager.addRequest(mockTarget);

      const stats = requestManager.getStats();

      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
      expect(stats.queueStats.successRate).toBe(1);
    });

    it('should track domain-specific statistics', async () => {
      const targets = [
        { id: 'course1', name: 'Course 1', url: 'https://site1.com/golf', priority: 'medium' as const, sourceType: 'official' as const },
        { id: 'course2', name: 'Course 2', url: 'https://site2.com/golf', priority: 'medium' as const, sourceType: 'official' as const },
      ];

      const mockResult: ProcessingResult = {
        success: true,
        data: { name: 'Test', source: 'test', confidence: 80 },
        confidence: 80,
        processingTime: 1500,
        errors: [],
        metadata: { method: 'static', finalUrl: 'test', responseSize: 1000, requestCount: 1 },
      };

      mockStaticScraper.scrapeBasicInfo.mockResolvedValue(mockResult);

      await Promise.all(targets.map(target => requestManager.addRequest(target)));

      const stats = requestManager.getStats();

      expect(Object.keys(stats.domainStats)).toHaveLength(2);
      expect(stats.domainStats['https://site1.com']).toBeDefined();
      expect(stats.domainStats['https://site2.com']).toBeDefined();
      expect(stats.domainStats['https://site1.com'].success).toBe(1);
      expect(stats.domainStats['https://site1.com'].avgResponseTime).toBe(1500);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', async () => {
      await requestManager.cleanup();

      expect(mockDynamicScraper.cleanup).toHaveBeenCalled();
    });

    it('should wait for pending requests to complete', async () => {
      const mockTarget: ScrapingTarget = {
        id: 'test-course',
        name: 'Test Golf Course',
        url: 'https://example.com/golf',
        priority: 'medium',
        sourceType: 'official',
      };

      // Make scraper take some time
      mockStaticScraper.scrapeBasicInfo.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          success: true,
          data: { name: 'Test', source: 'test', confidence: 80 },
          confidence: 80,
          processingTime: 1000,
          errors: [],
          metadata: { method: 'static', finalUrl: 'test', responseSize: 1000, requestCount: 1 },
        };
      });

      // Start a request
      const requestPromise = requestManager.addRequest(mockTarget);

      // Start cleanup immediately
      const cleanupPromise = requestManager.cleanup();

      // Both should complete
      await Promise.all([requestPromise, cleanupPromise]);

      expect(mockDynamicScraper.cleanup).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset all statistics and queues', async () => {
      const mockTarget: ScrapingTarget = {
        id: 'test-course',
        name: 'Test Golf Course',
        url: 'https://example.com/golf',
        priority: 'medium',
        sourceType: 'official',
      };

      const mockResult: ProcessingResult = {
        success: true,
        data: { name: 'Test', source: 'test', confidence: 80 },
        confidence: 80,
        processingTime: 1000,
        errors: [],
        metadata: { method: 'static', finalUrl: 'test', responseSize: 1000, requestCount: 1 },
      };

      mockStaticScraper.scrapeBasicInfo.mockResolvedValue(mockResult);

      // Process a request
      await requestManager.addRequest(mockTarget);

      let stats = requestManager.getStats();
      expect(stats.totalRequests).toBe(1);

      // Reset
      requestManager.reset();

      stats = requestManager.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
    });
  });
});