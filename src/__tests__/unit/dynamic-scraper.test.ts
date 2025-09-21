import { DynamicContentScraper } from '../../services/scrapers/dynamic-scraper';
import type { ScrapingTarget } from '../../types/scraping.types';
import { Browser, Page } from 'puppeteer';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

const mockPuppeteer = require('puppeteer');

describe('DynamicContentScraper', () => {
  let scraper: DynamicContentScraper;
  let mockBrowser: jest.Mocked<Browser>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    scraper = new DynamicContentScraper();

    // Setup mocks
    mockPage = {
      goto: jest.fn(),
      content: jest.fn(),
      close: jest.fn(),
      evaluate: jest.fn(),
      waitForSelector: jest.fn(),
      screenshot: jest.fn(),
      setUserAgent: jest.fn(),
      setViewport: jest.fn(),
      waitForLoadState: jest.fn(),
      url: jest.fn(),
    } as any;

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
      pages: jest.fn().mockResolvedValue([mockPage]),
    } as any;

    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
  });

  afterEach(async () => {
    await scraper.cleanup();
    jest.clearAllMocks();
  });

  describe('scrapeDynamicSite', () => {
    const mockTarget: ScrapingTarget = {
      id: 'test-spa-course',
      name: 'Test SPA Golf Course',
      url: 'https://spa-example.com/golf-course',
      priority: 'medium',
      sourceType: 'official',
    };

    it('should successfully scrape dynamic content from SPA', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test SPA Golf Course - Dynamic Loading</title>
            <meta name="description" content="A modern SPA golf course website with dynamic content.">
          </head>
          <body>
            <div id="app">
              <h1>Test SPA Golf Course</h1>
              <div class="course-info loaded">
                <div class="architect">Designed by Modern Architect</div>
                <div class="year">Opened in 2020</div>
                <div class="yardage">6800 yards</div>
                <div class="par">Par 71</div>
              </div>
              <div class="contact-info">
                <a href="tel:555-987-6543">Call Us</a>
                <a href="mailto:info@spacourse.com">Email</a>
              </div>
            </div>
          </body>
        </html>
      `;

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.content.mockResolvedValue(mockHtml);
      mockPage.url.mockReturnValue('https://spa-example.com/golf-course');
      mockPage.evaluate.mockResolvedValue({
        architect: 'Modern Architect',
        openingYear: 2020,
        totalYardage: 6800,
        parScore: 71,
      });

      const result = await scraper.scrapeDynamicSite(mockTarget);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Test SPA Golf Course');
      expect(result.data!.architect).toBe('Modern Architect');
      expect(result.data!.openingYear).toBe(2020);
      expect(result.data!.totalYardage).toBe(6800);
      expect(result.data!.parScore).toBe(71);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle JavaScript rendering timeout', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation timeout exceeded'));

      const result = await scraper.scrapeDynamicSite(mockTarget, {
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('network');
      expect(result.confidence).toBe(0);
    });

    it('should handle browser launch failures', async () => {
      mockPuppeteer.launch.mockRejectedValue(new Error('Failed to launch browser'));

      const result = await scraper.scrapeDynamicSite(mockTarget);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('browser');
      expect(result.confidence).toBe(0);
    });

    it('should wait for dynamic content to load', async () => {
      const initialHtml = `
        <html>
          <body>
            <div id="app">
              <div class="loading">Loading...</div>
            </div>
          </body>
        </html>
      `;

      const loadedHtml = `
        <html>
          <body>
            <div id="app">
              <h1>Dynamically Loaded Course</h1>
              <div class="course-data loaded">
                <div class="holes">18 holes</div>
                <div class="rating">Course Rating: 72.5</div>
              </div>
            </div>
          </body>
        </html>
      `;

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.waitForSelector.mockResolvedValue(null as any);
      mockPage.content.mockResolvedValue(loadedHtml);
      mockPage.url.mockReturnValue('https://spa-example.com/golf-course');

      const result = await scraper.scrapeDynamicSite(mockTarget, {
        waitForSelector: '.course-data.loaded',
      });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.course-data.loaded', {
        timeout: 10000,
      });
      expect(result.success).toBe(true);
    });

    it('should take screenshots when requested', async () => {
      const mockHtml = '<html><body><h1>Test Course</h1></body></html>';
      const mockScreenshot = Buffer.from('mock-screenshot-data');

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.content.mockResolvedValue(mockHtml);
      mockPage.url.mockReturnValue('https://spa-example.com/golf-course');
      mockPage.screenshot.mockResolvedValue(mockScreenshot);

      const result = await scraper.scrapeDynamicSite(mockTarget, {
        screenshots: true,
      });

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'png',
        fullPage: true,
      });
      expect(result.screenshots).toHaveLength(1);
      expect(result.screenshots![0]).toEqual(mockScreenshot);
    });

    it('should handle page evaluation errors', async () => {
      const mockHtml = '<html><body><h1>Test Course</h1></body></html>';

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.content.mockResolvedValue(mockHtml);
      mockPage.url.mockReturnValue('https://spa-example.com/golf-course');
      mockPage.evaluate.mockRejectedValue(new Error('JavaScript evaluation failed'));

      const result = await scraper.scrapeDynamicSite(mockTarget);

      expect(result.success).toBe(true); // Should still succeed with basic HTML parsing
      expect(result.data!.name).toBe('Test SPA Golf Course'); // Falls back to target name
    });

    it('should respect custom user agent', async () => {
      const mockHtml = '<html><body><h1>Test Course</h1></body></html>';
      const customUserAgent = 'Custom Golf Bot 1.0';

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.content.mockResolvedValue(mockHtml);
      mockPage.url.mockReturnValue('https://spa-example.com/golf-course');

      await scraper.scrapeDynamicSite(mockTarget, {
        userAgent: customUserAgent,
      });

      expect(mockPage.setUserAgent).toHaveBeenCalledWith(customUserAgent);
    });

    it('should manage browser sessions efficiently', async () => {
      const mockHtml = '<html><body><h1>Test Course</h1></body></html>';

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.content.mockResolvedValue(mockHtml);
      mockPage.url.mockReturnValue('https://spa-example.com/golf-course');

      // First request should launch browser
      const result1 = await scraper.scrapeDynamicSite(mockTarget);
      expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);

      // Second request should reuse browser
      const result2 = await scraper.scrapeDynamicSite(mockTarget);
      expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1); // Still only once

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle viewport configuration', async () => {
      const mockHtml = '<html><body><h1>Test Course</h1></body></html>';

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.content.mockResolvedValue(mockHtml);
      mockPage.url.mockReturnValue('https://spa-example.com/golf-course');

      await scraper.scrapeDynamicSite(mockTarget, {
        viewport: { width: 1920, height: 1080 },
      });

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
      });
    });

    it('should handle complex SPA routing', async () => {
      const finalHtml = `
        <html>
          <body>
            <div id="react-root">
              <div class="course-page">
                <h1>Routed Course Page</h1>
                <div class="course-details">
                  <span class="holes">18 holes</span>
                  <span class="par">Par 72</span>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.content.mockResolvedValue(finalHtml);
      mockPage.url.mockReturnValue('https://spa-example.com/courses/test-course');
      mockPage.waitForSelector.mockResolvedValue(null as any);

      const result = await scraper.scrapeDynamicSite(mockTarget, {
        waitForSelector: '.course-page',
        timeout: 15000,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.finalUrl).toBe('https://spa-example.com/courses/test-course');
    });
  });

  describe('cleanup', () => {
    it('should close all browser instances', async () => {
      // Trigger browser creation
      await scraper.scrapeDynamicSite({
        id: 'test',
        name: 'Test',
        url: 'https://example.com',
        priority: 'medium',
        sourceType: 'official',
      });

      await scraper.cleanup();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockBrowser.close.mockRejectedValue(new Error('Browser close failed'));

      // Should not throw
      await expect(scraper.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getBrowserStats', () => {
    it('should return correct browser statistics', async () => {
      // Initially no browsers
      let stats = scraper.getBrowserStats();
      expect(stats.activeSessions).toBe(0);
      expect(stats.totalSessions).toBe(0);

      // After creating a browser
      await scraper.scrapeDynamicSite({
        id: 'test',
        name: 'Test',
        url: 'https://example.com',
        priority: 'medium',
        sourceType: 'official',
      });

      stats = scraper.getBrowserStats();
      expect(stats.activeSessions).toBe(1);
      expect(stats.totalSessions).toBe(1);
    });
  });
});