import { StaticContentScraper } from '../../services/scrapers/static-scraper';
import type { ScrapingTarget } from '../../types/scraping.types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('StaticContentScraper', () => {
  let scraper: StaticContentScraper;

  beforeEach(() => {
    scraper = new StaticContentScraper();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('scrapeBasicInfo', () => {
    const mockTarget: ScrapingTarget = {
      id: 'test-course',
      name: 'Test Golf Course',
      url: 'https://example.com/golf-course',
      priority: 'medium',
      sourceType: 'official',
    };

    it('should successfully scrape basic course information', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test Golf Course - Premium Golf Experience</title>
            <meta name="description" content="A beautiful 18-hole championship golf course designed by Tom Fazio.">
          </head>
          <body>
            <h1>Test Golf Course</h1>
            <div class="description">
              Test Golf Course is a championship 18-hole golf course designed by renowned architect Tom Fazio.
              Opened in 1995, this par-72 course spans 7,200 yards of pristine fairways.
            </div>
            <div class="contact">
              <p>Phone: (555) 123-4567</p>
              <p>Email: info@testgolf.com</p>
            </div>
            <div class="pricing">Green fees: $150-200</div>
            <img src="/images/hero.jpg" alt="Course hero image">
          </body>
        </html>
      `;

      mockedAxios.create.mockReturnThis();
      mockedAxios.mockResolvedValue({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {},
      });

      const result = await scraper.scrapeBasicInfo(mockTarget);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Test Golf Course');
      expect(result.data!.architect).toBe('Tom Fazio');
      expect(result.data!.openingYear).toBe(1995);
      expect(result.data!.parScore).toBe(72);
      expect(result.data!.totalYardage).toBe(7200);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.create.mockReturnThis();
      mockedAxios.mockRejectedValue(new Error('Network error'));

      const result = await scraper.scrapeBasicInfo(mockTarget);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('parsing');
      expect(result.confidence).toBe(0);
    });

    it('should handle malformed HTML', async () => {
      const malformedHtml = '<html><title>Test</title><body><h1>Incomplete';

      mockedAxios.create.mockReturnThis();
      mockedAxios.mockResolvedValue({
        data: malformedHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {},
      });

      const result = await scraper.scrapeBasicInfo(mockTarget);

      expect(result.success).toBe(true); // Should still succeed with partial data
      expect(result.data!.name).toBe('Test Golf Course'); // Falls back to target name
    });

    it('should extract contact information correctly', async () => {
      const htmlWithContact = `
        <html>
          <body>
            <h1>Golf Course</h1>
            <a href="tel:+1-555-123-4567">Call us</a>
            <a href="mailto:info@golf.com">Email us</a>
            <div class="address">123 Golf Lane, Golf City, GC 12345</div>
          </body>
        </html>
      `;

      mockedAxios.create.mockReturnThis();
      mockedAxios.mockResolvedValue({
        data: htmlWithContact,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {},
      });

      const result = await scraper.scrapeBasicInfo(mockTarget);

      expect(result.success).toBe(true);
      expect(result.contact!.phone).toContain('555-123-4567');
      expect(result.contact!.email).toBe('info@golf.com');
      expect(result.contact!.address).toContain('123 Golf Lane');
    });

    it('should extract images correctly', async () => {
      const htmlWithImages = `
        <html>
          <body>
            <h1>Golf Course</h1>
            <div class="hero">
              <img src="/images/hero.jpg" alt="Hero image">
            </div>
            <div class="gallery">
              <img src="/images/gallery1.jpg" alt="Gallery 1">
              <img src="/images/gallery2.jpg" alt="Gallery 2">
            </div>
          </body>
        </html>
      `;

      mockedAxios.create.mockReturnThis();
      mockedAxios.mockResolvedValue({
        data: htmlWithImages,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {
          responseURL: 'https://example.com/golf-course',
        },
      });

      const result = await scraper.scrapeBasicInfo(mockTarget);

      expect(result.success).toBe(true);
      expect(result.images!.hero).toHaveLength(1);
      expect(result.images!.gallery).toHaveLength(2);
      expect(result.images!.hero![0]).toBe('https://example.com/images/hero.jpg');
    });

    it('should calculate confidence score appropriately', async () => {
      const completeHtml = `
        <html>
          <head>
            <meta name="description" content="Complete golf course description">
          </head>
          <body>
            <h1>Complete Golf Course</h1>
            <div class="description">Detailed description here</div>
            <div class="architect">Designed by Famous Architect</div>
            <div class="year">Opened in 2000</div>
            <div class="yardage">7000 yards</div>
            <div class="par">Par 72</div>
            <a href="tel:555-123-4567">Phone</a>
            <a href="mailto:info@golf.com">Email</a>
            <img src="/hero.jpg" alt="Hero">
          </body>
        </html>
      `;

      mockedAxios.create.mockReturnThis();
      mockedAxios.mockResolvedValue({
        data: completeHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {},
      });

      const result = await scraper.scrapeBasicInfo(mockTarget);

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(80); // Should be high with complete data
    });
  });
});