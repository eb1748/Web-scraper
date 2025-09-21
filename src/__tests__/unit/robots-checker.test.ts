import { RobotsChecker } from '../../services/scrapers/robots-checker';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RobotsChecker', () => {
  let robotsChecker: RobotsChecker;

  beforeEach(() => {
    robotsChecker = new RobotsChecker();
    jest.clearAllMocks();
  });

  afterEach(() => {
    robotsChecker.clearCache();
  });

  describe('canScrape', () => {
    it('should allow scraping when no robots.txt exists', async () => {
      mockedAxios.get.mockRejectedValue({ response: { status: 404 } });

      const result = await robotsChecker.canScrape('https://example.com/page');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('No robots.txt found');
      expect(result.crawlDelay).toBe(2000); // Default delay
      expect(result.cacheHit).toBe(false);
    });

    it('should parse robots.txt and allow scraping for allowed paths', async () => {
      const robotsTxt = `
User-agent: *
Allow: /
Disallow: /admin
Disallow: /private
Crawl-delay: 1
Sitemap: https://example.com/sitemap.xml
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const result = await robotsChecker.canScrape('https://example.com/public-page');

      expect(result.allowed).toBe(true);
      expect(result.crawlDelay).toBe(1000); // 1 second converted to ms
      expect(result.directive).toBeDefined();
      expect(result.directive!.sitemap).toContain('https://example.com/sitemap.xml');
    });

    it('should deny scraping for disallowed paths', async () => {
      const robotsTxt = `
User-agent: *
Disallow: /admin
Disallow: /private/*
Allow: /
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const result = await robotsChecker.canScrape('https://example.com/admin/users');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('disallowed by robots.txt');
    });

    it('should handle wildcard patterns in disallow rules', async () => {
      const robotsTxt = `
User-agent: *
Disallow: /api/*
Disallow: *.json
Allow: /
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const apiResult = await robotsChecker.canScrape('https://example.com/api/users');
      const jsonResult = await robotsChecker.canScrape('https://example.com/data.json');
      const allowedResult = await robotsChecker.canScrape('https://example.com/about');

      expect(apiResult.allowed).toBe(false);
      expect(jsonResult.allowed).toBe(false);
      expect(allowedResult.allowed).toBe(true);
    });

    it('should respect specific user-agent rules', async () => {
      const robotsTxt = `
User-agent: Googlebot
Disallow: /admin

User-agent: GolfCourseBot
Allow: /
Disallow: /private

User-agent: *
Disallow: /
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const result = await robotsChecker.canScrape(
        'https://example.com/courses',
        'GolfCourseBot/1.0'
      );

      expect(result.allowed).toBe(true);
    });

    it('should handle more specific allow rules overriding disallow', async () => {
      const robotsTxt = `
User-agent: *
Disallow: /golf/*
Allow: /golf/courses
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const disallowedResult = await robotsChecker.canScrape('https://example.com/golf/admin');
      const allowedResult = await robotsChecker.canScrape('https://example.com/golf/courses');

      expect(disallowedResult.allowed).toBe(false);
      expect(allowedResult.allowed).toBe(true);
    });

    it('should use cached results for subsequent requests', async () => {
      const robotsTxt = `
User-agent: *
Allow: /
Crawl-delay: 5
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      // First request
      const result1 = await robotsChecker.canScrape('https://example.com/page1');
      expect(result1.cacheHit).toBe(false);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Second request to same domain
      const result2 = await robotsChecker.canScrape('https://example.com/page2');
      expect(result2.cacheHit).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await robotsChecker.canScrape('https://example.com/page');

      expect(result.allowed).toBe(true); // Conservative approach
      expect(result.crawlDelay).toBe(4000); // Double default delay
      expect(result.reason).toContain('Error checking robots.txt');
    });

    it('should handle malformed robots.txt gracefully', async () => {
      const malformedRobotsTxt = `
Invalid line without colon
User-agent: *
Disallow /missing-colon
Allow: /valid
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: malformedRobotsTxt,
      });

      const result = await robotsChecker.canScrape('https://example.com/valid');

      expect(result.allowed).toBe(true);
    });
  });

  describe('getRobotsInfo', () => {
    it('should return comprehensive robots.txt information', async () => {
      const robotsTxt = `
# Golf course robots.txt
User-agent: *
Allow: /courses
Disallow: /admin
Crawl-delay: 2
Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/courses-sitemap.xml
Host: www.example.com
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const info = await robotsChecker.getRobotsInfo('https://example.com');

      expect(info.exists).toBe(true);
      expect(info.content).toBe(robotsTxt);
      expect(info.directive).toBeDefined();
      expect(info.sitemaps).toHaveLength(2);
      expect(info.crawlDelay).toBe(2000);
      expect(info.lastChecked).toBeInstanceOf(Date);
    });

    it('should indicate when robots.txt does not exist', async () => {
      mockedAxios.get.mockResolvedValue({ status: 404 });

      const info = await robotsChecker.getRobotsInfo('https://example.com');

      expect(info.exists).toBe(false);
      expect(info.content).toBeUndefined();
      expect(info.directive).toBeUndefined();
    });
  });

  describe('validateRobotsTxt', () => {
    it('should validate correct robots.txt syntax', () => {
      const validRobotsTxt = `
User-agent: *
Allow: /
Disallow: /admin
Crawl-delay: 1
Sitemap: https://example.com/sitemap.xml
      `;

      const validation = robotsChecker.validateRobotsTxt(validRobotsTxt);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing user-agent directives', () => {
      const invalidRobotsTxt = `
Disallow: /admin
Allow: /public
      `;

      const validation = robotsChecker.validateRobotsTxt(invalidRobotsTxt);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Line 2: Disallow directive without preceding User-agent');
    });

    it('should detect empty user-agent values', () => {
      const invalidRobotsTxt = `
User-agent:
Disallow: /admin
      `;

      const validation = robotsChecker.validateRobotsTxt(invalidRobotsTxt);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Line 2: User-agent cannot be empty');
    });

    it('should detect invalid crawl-delay values', () => {
      const invalidRobotsTxt = `
User-agent: *
Crawl-delay: not-a-number
Disallow: /admin
      `;

      const validation = robotsChecker.validateRobotsTxt(invalidRobotsTxt);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Line 3: Invalid crawl-delay value "not-a-number"');
    });

    it('should warn about potentially invalid sitemap URLs', () => {
      const robotsTxt = `
User-agent: *
Sitemap: not-a-valid-url
Sitemap: https://example.com/valid.xml
      `;

      const validation = robotsChecker.validateRobotsTxt(robotsTxt);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Line 3: Sitemap URL may be invalid: "not-a-valid-url"');
    });

    it('should ignore comments and empty lines', () => {
      const robotsTxt = `
# This is a comment
User-agent: *

# Another comment
Disallow: /admin

      `;

      const validation = robotsChecker.validateRobotsTxt(robotsTxt);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should warn about unknown directives', () => {
      const robotsTxt = `
User-agent: *
Custom-directive: some-value
Disallow: /admin
      `;

      const validation = robotsChecker.validateRobotsTxt(robotsTxt);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Line 3: Unknown directive: "Custom-directive: some-value"');
    });
  });

  describe('cache management', () => {
    it('should clear cache for specific domain', async () => {
      const robotsTxt = 'User-agent: *\nAllow: /';

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      // Populate cache
      await robotsChecker.canScrape('https://example.com/page');
      let stats = robotsChecker.getCacheStats();
      expect(stats.size).toBe(1);

      // Clear specific domain
      robotsChecker.clearCache('https://example.com');
      stats = robotsChecker.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should clear entire cache', async () => {
      const robotsTxt = 'User-agent: *\nAllow: /';

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      // Populate cache with multiple domains
      await robotsChecker.canScrape('https://example1.com/page');
      await robotsChecker.canScrape('https://example2.com/page');

      let stats = robotsChecker.getCacheStats();
      expect(stats.size).toBe(2);

      // Clear all
      robotsChecker.clearCache();
      stats = robotsChecker.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should provide accurate cache statistics', async () => {
      const robotsTxt = 'User-agent: *\nAllow: /';

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      // Initially empty
      let stats = robotsChecker.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.domains).toHaveLength(0);

      // Add entries
      await robotsChecker.canScrape('https://example1.com/page');
      await robotsChecker.canScrape('https://example2.com/page');

      stats = robotsChecker.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.domains).toContain('https://example1.com');
      expect(stats.domains).toContain('https://example2.com');
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });
  });

  describe('pattern matching', () => {
    it('should match simple prefix patterns', async () => {
      const robotsTxt = `
User-agent: *
Disallow: /admin
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const adminResult = await robotsChecker.canScrape('https://example.com/admin');
      const adminSubResult = await robotsChecker.canScrape('https://example.com/admin/users');
      const publicResult = await robotsChecker.canScrape('https://example.com/public');

      expect(adminResult.allowed).toBe(false);
      expect(adminSubResult.allowed).toBe(false);
      expect(publicResult.allowed).toBe(true);
    });

    it('should match wildcard patterns correctly', async () => {
      const robotsTxt = `
User-agent: *
Disallow: /api/*
Disallow: *.pdf
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const apiResult = await robotsChecker.canScrape('https://example.com/api/v1/users');
      const pdfResult = await robotsChecker.canScrape('https://example.com/document.pdf');
      const htmlResult = await robotsChecker.canScrape('https://example.com/page.html');

      expect(apiResult.allowed).toBe(false);
      expect(pdfResult.allowed).toBe(false);
      expect(htmlResult.allowed).toBe(true);
    });

    it('should handle root disallow pattern', async () => {
      const robotsTxt = `
User-agent: BadBot
Disallow: /

User-agent: *
Allow: /
      `;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const goodBotResult = await robotsChecker.canScrape('https://example.com/page', 'GoodBot');
      const badBotResult = await robotsChecker.canScrape('https://example.com/page', 'BadBot');

      expect(goodBotResult.allowed).toBe(true);
      expect(badBotResult.allowed).toBe(false);
    });
  });
});