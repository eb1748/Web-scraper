import { CourseScrapingOrchestrator } from '../../scripts/scrape-courses';
import { RequestManager } from '../../services/scrapers/request-manager';
import { StaticContentScraper } from '../../services/scrapers/static-scraper';
import { DynamicContentScraper } from '../../services/scrapers/dynamic-scraper';
import { RobotsChecker } from '../../services/scrapers/robots-checker';
import type { ScrapingTarget } from '../../types/scraping.types';
import { db } from '../../utils/database';

// Mock external dependencies
jest.mock('../../utils/database');
jest.mock('../../utils/logger');
jest.mock('fs-extra');

const mockDb = db as jest.Mocked<typeof db>;

describe('Scraping Workflow Integration', () => {
  let orchestrator: CourseScrapingOrchestrator;

  beforeEach(() => {
    // Setup database mock
    mockDb.connect = jest.fn();
    mockDb.disconnect = jest.fn();
    mockDb.getClient = jest.fn().mockReturnValue({
      course: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      scrapingLog: {
        create: jest.fn(),
      },
    });

    orchestrator = new CourseScrapingOrchestrator();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('end-to-end scraping workflow', () => {
    it('should complete full scraping session with sample targets', async () => {
      // Mock database responses
      const mockCourseData = {
        id: 'pebble-beach',
        name: 'Pebble Beach Golf Links',
        website: 'https://www.pebblebeach.com/golf/pebble-beach-golf-links/',
        location: 'Pebble Beach, CA',
        majorChampionships: [],
        lastUpdated: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days old
      };

      mockDb.getClient().course.findMany.mockResolvedValue([mockCourseData]);
      mockDb.getClient().course.upsert.mockResolvedValue(mockCourseData);
      mockDb.getClient().scrapingLog.create.mockResolvedValue({});

      // Create sample targets
      const sampleTargets: ScrapingTarget[] = [
        {
          id: 'test-course-1',
          name: 'Test Golf Course 1',
          url: 'https://example-golf1.com',
          priority: 'high',
          sourceType: 'official',
          metadata: {
            successCount: 0,
            failureCount: 0,
            avgResponseTime: 0,
          },
        },
        {
          id: 'test-course-2',
          name: 'Test Golf Course 2',
          url: 'https://example-golf2.com',
          priority: 'medium',
          sourceType: 'directory',
          metadata: {
            successCount: 0,
            failureCount: 0,
            avgResponseTime: 0,
          },
        },
      ];

      const session = await orchestrator.scrapeCourses(sampleTargets);

      expect(session).toBeDefined();
      expect(session.totalCourses).toBe(2);
      expect(mockDb.connect).toHaveBeenCalled();
      expect(mockDb.disconnect).toHaveBeenCalled();
    }, 30000); // 30 second timeout for integration test

    it('should handle mixed success and failure scenarios', async () => {
      mockDb.getClient().course.findMany.mockResolvedValue([]);
      mockDb.getClient().course.upsert.mockResolvedValue({});
      mockDb.getClient().scrapingLog.create.mockResolvedValue({});

      const mixedTargets: ScrapingTarget[] = [
        {
          id: 'working-course',
          name: 'Working Golf Course',
          url: 'https://httpbin.org/html', // This should work
          priority: 'high',
          sourceType: 'official',
        },
        {
          id: 'failing-course',
          name: 'Failing Golf Course',
          url: 'https://httpbin.org/status/500', // This should fail
          priority: 'medium',
          sourceType: 'official',
        },
      ];

      const session = await orchestrator.scrapeCourses(mixedTargets);

      expect(session.totalCourses).toBe(2);
      expect(session.successfulCourses).toBeGreaterThanOrEqual(0);
      expect(session.failedCourses).toBeGreaterThanOrEqual(0);
      expect(session.successfulCourses + session.failedCourses).toBe(2);
    }, 30000);
  });

  describe('RequestManager integration', () => {
    let requestManager: RequestManager;

    beforeEach(() => {
      requestManager = new RequestManager();
    });

    afterEach(async () => {
      await requestManager.cleanup();
    });

    it('should process multiple requests with rate limiting', async () => {
      const targets: ScrapingTarget[] = [
        {
          id: 'course-1',
          name: 'Course 1',
          url: 'https://httpbin.org/delay/1',
          priority: 'high',
          sourceType: 'official',
        },
        {
          id: 'course-2',
          name: 'Course 2',
          url: 'https://httpbin.org/delay/1',
          priority: 'medium',
          sourceType: 'official',
        },
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        targets.map(target => requestManager.addRequest(target))
      );
      const endTime = Date.now();

      // Should take at least some time due to rate limiting and delays
      expect(endTime - startTime).toBeGreaterThan(2000);
      expect(results).toHaveLength(2);
    }, 20000);

    it('should respect robots.txt when available', async () => {
      const target: ScrapingTarget = {
        id: 'robots-test',
        name: 'Robots Test Site',
        url: 'https://httpbin.org/robots.txt',
        priority: 'medium',
        sourceType: 'official',
      };

      // This should work as httpbin.org has a robots.txt
      const result = await requestManager.addRequest(target);
      expect(result).toBeDefined();
    }, 15000);
  });

  describe('scraper component integration', () => {
    let staticScraper: StaticContentScraper;
    let robotsChecker: RobotsChecker;

    beforeEach(() => {
      staticScraper = new StaticContentScraper();
      robotsChecker = new RobotsChecker();
    });

    it('should extract data from real HTML content', async () => {
      const target: ScrapingTarget = {
        id: 'html-test',
        name: 'HTML Test Site',
        url: 'https://httpbin.org/html',
        priority: 'medium',
        sourceType: 'official',
      };

      const result = await staticScraper.scrapeBasicInfo(target);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    }, 15000);

    it('should handle robots.txt checking for real sites', async () => {
      const result = await robotsChecker.canScrape('https://httpbin.org/anything');

      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
      expect(result.checkedAt).toBeInstanceOf(Date);
    }, 10000);

    it('should provide comprehensive robots.txt information', async () => {
      const info = await robotsChecker.getRobotsInfo('https://httpbin.org');

      expect(info).toBeDefined();
      expect(info.exists).toBeDefined();
      expect(info.lastChecked).toBeInstanceOf(Date);
    }, 10000);
  });

  describe('error handling and resilience', () => {
    let requestManager: RequestManager;

    beforeEach(() => {
      requestManager = new RequestManager();
    });

    afterEach(async () => {
      await requestManager.cleanup();
    });

    it('should handle network timeouts gracefully', async () => {
      const target: ScrapingTarget = {
        id: 'timeout-test',
        name: 'Timeout Test',
        url: 'https://httpbin.org/delay/30', // 30 second delay
        priority: 'medium',
        sourceType: 'official',
      };

      const result = await requestManager.addRequest(target, { timeout: 5000 });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('network');
    }, 15000);

    it('should handle 404 errors appropriately', async () => {
      const target: ScrapingTarget = {
        id: '404-test',
        name: '404 Test',
        url: 'https://httpbin.org/status/404',
        priority: 'medium',
        sourceType: 'official',
      };

      const result = await requestManager.addRequest(target);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }, 10000);

    it('should handle server errors with retries', async () => {
      const target: ScrapingTarget = {
        id: '500-test',
        name: '500 Test',
        url: 'https://httpbin.org/status/500',
        priority: 'medium',
        sourceType: 'official',
      };

      const result = await requestManager.addRequest(target);

      // Should attempt retries before failing
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }, 20000);
  });

  describe('performance and concurrency', () => {
    let requestManager: RequestManager;

    beforeEach(() => {
      requestManager = new RequestManager();
    });

    afterEach(async () => {
      await requestManager.cleanup();
    });

    it('should handle concurrent requests efficiently', async () => {
      const targets: ScrapingTarget[] = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-${i}`,
        name: `Concurrent Course ${i}`,
        url: `https://httpbin.org/delay/1`,
        priority: 'medium',
        sourceType: 'official',
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        targets.map(target => requestManager.addRequest(target))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(5);

      // With concurrency, should not take 5x the time of a single request
      expect(endTime - startTime).toBeLessThan(10000);
    }, 30000);

    it('should provide accurate statistics during operation', async () => {
      const targets: ScrapingTarget[] = [
        {
          id: 'stats-1',
          name: 'Stats Course 1',
          url: 'https://httpbin.org/html',
          priority: 'medium',
          sourceType: 'official',
        },
        {
          id: 'stats-2',
          name: 'Stats Course 2',
          url: 'https://httpbin.org/status/404',
          priority: 'medium',
          sourceType: 'official',
        },
      ];

      await Promise.allSettled(
        targets.map(target => requestManager.addRequest(target))
      );

      const stats = requestManager.getStats();

      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests + stats.failedRequests).toBe(2);
      expect(stats.queueStats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.queueStats.successRate).toBeLessThanOrEqual(1);
    }, 20000);
  });
});