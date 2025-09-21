import puppeteer, { type Browser, type Page, type PuppeteerLaunchOptions } from 'puppeteer';
import * as fs from 'fs-extra';
import * as path from 'path';
import type {
  ScrapingTarget,
  ScrapingOptions,
  CourseBasicInfo,
  ContactInfo,
  CourseImages,
  ProcessingResult,
  BrowserSession,
  PageSession,
  ScrapingError,
} from '../../types/scraping.types';
import { scrapingLogger } from '../../utils/logger';
import { NetworkError, ScrapingError as CustomScrapingError } from '../../utils/errors';
import { storageManager } from '../../utils/storage';
import config from '../../config/config';

export class DynamicContentScraper {
  private browsers: Map<string, BrowserSession> = new Map();
  private pages: Map<string, PageSession> = new Map();
  private readonly maxBrowsers: number = 3;
  private readonly maxPagesPerBrowser: number = 5;
  private readonly sessionTimeout: number = 30 * 60 * 1000; // 30 minutes
  private readonly pageTimeout: number = 30000; // 30 seconds
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Main scraping method for dynamic content
   */
  async scrapeDynamicSite(target: ScrapingTarget, options?: Partial<ScrapingOptions>): Promise<ProcessingResult> {
    const startTime = Date.now();
    const requestId = `dynamic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let page: Page | null = null;
    let sessionId: string | null = null;

    try {
      scrapingLogger.info(`Starting dynamic scraping for ${target.name}`, {
        url: target.url,
        requestId,
      });

      // Get or create browser session
      const browserSession = await this.getBrowserSession();
      sessionId = browserSession.id;

      // Get or create page
      page = await this.getPage(browserSession);

      // Configure page
      await this.configurePage(page, options);

      // Navigate and wait for content
      const response = await this.navigateToPage(page, target.url, options);

      // Wait for dynamic content to load
      await this.waitForContent(page, options);

      // Take screenshot if enabled
      let screenshotPath: string | undefined;
      if (options?.screenshots !== false) {
        screenshotPath = await this.takeScreenshot(page, target.id);
      }

      // Extract data using page evaluation
      const extractedData = await this.extractPageData(page, target);

      // Calculate confidence score
      const confidence = this.calculateConfidence(extractedData);

      const processingTime = Date.now() - startTime;

      scrapingLogger.info(`Dynamic scraping completed for ${target.name}`, {
        requestId,
        processingTime,
        confidence,
        finalUrl: page.url(),
      });

      return {
        success: true,
        data: extractedData.course,
        images: extractedData.images,
        contact: extractedData.contact,
        errors: [],
        warnings: extractedData.warnings || [],
        processingTime,
        confidence,
        source: target.url,
        metadata: {
          method: 'dynamic',
          screenshots: screenshotPath ? [screenshotPath] : [],
          finalUrl: page.url(),
          redirects: [], // Would need to track redirects
          responseSize: await this.getPageSize(page),
          resourcesLoaded: await this.getResourceCount(page),
        },
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const scrapingError = this.handleError(error, target.url);

      scrapingLogger.error(`Dynamic scraping failed for ${target.name}`, error, {
        requestId,
        processingTime,
        errorType: scrapingError.type,
        finalUrl: page?.url(),
      });

      return {
        success: false,
        errors: [scrapingError],
        warnings: [],
        processingTime,
        confidence: 0,
        source: target.url,
        metadata: {
          method: 'dynamic',
          screenshots: [],
          finalUrl: page?.url() || target.url,
          redirects: [],
          responseSize: 0,
          resourcesLoaded: 0,
        },
      };
    } finally {
      // Return page to pool instead of closing
      if (page && sessionId) {
        await this.returnPage(sessionId, page);
      }
    }
  }

  /**
   * Get or create browser session
   */
  private async getBrowserSession(): Promise<BrowserSession> {
    // Find available browser or create new one
    for (const [id, session] of this.browsers) {
      if (session.requestCount < session.maxRequests && Date.now() - session.lastUsed.getTime() < this.sessionTimeout) {
        session.lastUsed = new Date();
        session.requestCount++;
        return session;
      }
    }

    // Create new browser if under limit
    if (this.browsers.size < this.maxBrowsers) {
      return await this.createBrowserSession();
    }

    // Close oldest browser and create new one
    const oldestSession = Array.from(this.browsers.values())
      .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime())[0];

    await this.closeBrowserSession(oldestSession.id);
    return await this.createBrowserSession();
  }

  /**
   * Create new browser session
   */
  private async createBrowserSession(): Promise<BrowserSession> {
    const sessionId = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const launchOptions: PuppeteerLaunchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
      executablePath: process.env.CHROME_BIN || undefined,
    };

    const browser = await puppeteer.launch(launchOptions);

    const session: BrowserSession = {
      id: sessionId,
      browser,
      pages: [],
      createdAt: new Date(),
      lastUsed: new Date(),
      requestCount: 1,
      maxRequests: 50,
      userAgent: config.scraping.userAgent,
    };

    this.browsers.set(sessionId, session);

    scrapingLogger.info(`Created browser session ${sessionId}`);

    return session;
  }

  /**
   * Get or create page from browser session
   */
  private async getPage(browserSession: BrowserSession): Promise<Page> {
    // Find available page
    for (const pageSession of this.pages.values()) {
      if (pageSession.sessionId === browserSession.id && !pageSession.busy) {
        pageSession.busy = true;
        pageSession.lastUsed = new Date();
        return pageSession.page;
      }
    }

    // Create new page if under limit
    const sessionPages = Array.from(this.pages.values())
      .filter(p => p.sessionId === browserSession.id);

    if (sessionPages.length < this.maxPagesPerBrowser) {
      return await this.createPage(browserSession);
    }

    // Close oldest page and create new one
    const oldestPage = sessionPages
      .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime())[0];

    await this.closePage(oldestPage.id);
    return await this.createPage(browserSession);
  }

  /**
   * Create new page in browser session
   */
  private async createPage(browserSession: BrowserSession): Promise<Page> {
    const page = await browserSession.browser.newPage();
    const pageId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const pageSession: PageSession = {
      id: pageId,
      page,
      sessionId: browserSession.id,
      createdAt: new Date(),
      lastUsed: new Date(),
      busy: true,
    };

    this.pages.set(pageId, pageSession);
    browserSession.pages.push(page);

    scrapingLogger.debug(`Created page ${pageId} in session ${browserSession.id}`);

    return page;
  }

  /**
   * Configure page settings
   */
  private async configurePage(page: Page, options?: Partial<ScrapingOptions>): Promise<void> {
    // Set user agent
    await page.setUserAgent(options?.userAgent || config.scraping.userAgent);

    // Set viewport
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    });

    // Set timeout
    page.setDefaultTimeout(options?.timeout || this.pageTimeout);

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Handle JavaScript errors
    page.on('pageerror', (error) => {
      scrapingLogger.warn('Page JavaScript error', { error: error.message });
    });

    // Handle console messages
    page.on('console', (message) => {
      if (message.type() === 'error') {
        scrapingLogger.warn('Page console error', { message: message.text() });
      }
    });
  }

  /**
   * Navigate to page with proper error handling
   */
  private async navigateToPage(
    page: Page,
    url: string,
    options?: Partial<ScrapingOptions>
  ): Promise<any> {
    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: options?.timeout || this.pageTimeout,
      });

      if (!response) {
        throw new NetworkError('No response received', url);
      }

      if (!response.ok()) {
        throw new NetworkError(
          `HTTP ${response.status()}: ${response.statusText()}`,
          url,
          'GET',
          response.status()
        );
      }

      return response;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new NetworkError('Navigation timeout', url);
      }
      throw error;
    }
  }

  /**
   * Wait for dynamic content to load
   */
  private async waitForContent(page: Page, options?: Partial<ScrapingOptions>): Promise<void> {
    try {
      // Wait for specific selector if provided
      if (options?.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: 10000,
        });
      }

      // Additional wait time for JavaScript to execute
      if (options?.waitTime) {
        await page.waitForTimeout(options.waitTime);
      } else {
        await page.waitForTimeout(2000); // Default 2 seconds
      }

      // Wait for any pending network requests
      await page.waitForLoadState('networkidle');
    } catch (error) {
      scrapingLogger.warn('Timeout waiting for content', { error: error.message });
      // Continue anyway
    }
  }

  /**
   * Extract all data from the page
   */
  private async extractPageData(page: Page, target: ScrapingTarget): Promise<{
    course: CourseBasicInfo;
    contact: ContactInfo;
    images: CourseImages;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      const result = await page.evaluate((targetName: string) => {
        // This runs in the browser context
        const extractedData = {
          course: {} as any,
          contact: {} as any,
          images: { hero: [], gallery: [], courseMap: [], aerial: [], amenities: [] } as any,
        };

        // Extract course name
        extractedData.course.name = targetName; // Fallback
        const nameSelectors = ['h1', '.course-name', '.page-title', 'title'];
        for (const selector of nameSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent?.trim()) {
            extractedData.course.name = element.textContent.trim();
            break;
          }
        }

        // Extract description
        const descSelectors = ['.course-description', '.about-course', '.description', 'meta[name="description"]'];
        for (const selector of descSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const content = element.getAttribute('content') || element.textContent;
            if (content?.trim()) {
              extractedData.course.description = content.trim();
              break;
            }
          }
        }

        // Extract architect
        const archSelectors = ['.architect', '.designer'];
        for (const selector of archSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent?.trim()) {
            extractedData.course.architect = element.textContent.trim();
            break;
          }
        }

        // Extract phone
        const phoneElement = document.querySelector('a[href^="tel:"], .phone, .contact-phone');
        if (phoneElement) {
          const href = phoneElement.getAttribute('href');
          if (href && href.startsWith('tel:')) {
            extractedData.contact.phone = href.replace('tel:', '');
          } else if (phoneElement.textContent) {
            extractedData.contact.phone = phoneElement.textContent.trim();
          }
        }

        // Extract email
        const emailElement = document.querySelector('a[href^="mailto:"], .email, .contact-email');
        if (emailElement) {
          const href = emailElement.getAttribute('href');
          if (href && href.startsWith('mailto:')) {
            extractedData.contact.email = href.replace('mailto:', '');
          } else if (emailElement.textContent) {
            const emailMatch = emailElement.textContent.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
            if (emailMatch) {
              extractedData.contact.email = emailMatch[0];
            }
          }
        }

        // Extract images
        const heroImages = document.querySelectorAll('.hero img, .banner img, .main-image img');
        heroImages.forEach((img: Element) => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !extractedData.images.hero.includes(src)) {
            extractedData.images.hero.push(src);
          }
        });

        const galleryImages = document.querySelectorAll('.gallery img, .photo-gallery img, .course-photos img');
        galleryImages.forEach((img: Element) => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !extractedData.images.gallery.includes(src)) {
            extractedData.images.gallery.push(src);
          }
        });

        return extractedData;
      }, target.name);

      // Process extracted data
      const courseData: CourseBasicInfo = {
        name: result.course.name || target.name,
        description: result.course.description,
        architect: result.course.architect,
        source: target.url,
        extractedAt: new Date(),
        confidence: 0, // Will be calculated later
      };

      const contactData: ContactInfo = {
        phone: result.contact.phone,
        email: result.contact.email,
      };

      const imageData: CourseImages = {
        hero: this.resolveImageUrls(result.images.hero, page.url()),
        gallery: this.resolveImageUrls(result.images.gallery, page.url()),
        courseMap: this.resolveImageUrls(result.images.courseMap, page.url()),
        aerial: this.resolveImageUrls(result.images.aerial, page.url()),
        amenities: this.resolveImageUrls(result.images.amenities, page.url()),
      };

      return {
        course: courseData,
        contact: contactData,
        images: imageData,
        warnings,
      };

    } catch (error) {
      scrapingLogger.error('Error extracting page data', error);
      warnings.push(`Data extraction error: ${error.message}`);

      return {
        course: {
          name: target.name,
          source: target.url,
          extractedAt: new Date(),
          confidence: 0,
        },
        contact: {},
        images: { hero: [], gallery: [], courseMap: [], aerial: [], amenities: [] },
        warnings,
      };
    }
  }

  /**
   * Take screenshot of the page
   */
  private async takeScreenshot(page: Page, courseId: string): Promise<string> {
    try {
      await storageManager.ensureCourseDirectories(courseId);
      const screenshotDir = storageManager.getCourseMediaDir(courseId);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = path.join(screenshotDir, 'original', filename);

      await page.screenshot({
        path: filepath,
        fullPage: true,
        type: 'png',
      });

      scrapingLogger.debug(`Screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      scrapingLogger.error('Failed to take screenshot', error);
      throw error;
    }
  }

  /**
   * Get page size in bytes
   */
  private async getPageSize(page: Page): Promise<number> {
    try {
      const content = await page.content();
      return Buffer.byteLength(content, 'utf8');
    } catch {
      return 0;
    }
  }

  /**
   * Get count of loaded resources
   */
  private async getResourceCount(page: Page): Promise<number> {
    try {
      return await page.evaluate(() => {
        return performance.getEntriesByType('resource').length;
      });
    } catch {
      return 0;
    }
  }

  /**
   * Resolve relative image URLs to absolute URLs
   */
  private resolveImageUrls(urls: string[], baseUrl: string): string[] {
    return urls.map(url => {
      try {
        if (url.startsWith('http')) {
          return url;
        }
        return new URL(url, baseUrl).toString();
      } catch {
        return url;
      }
    }).filter(Boolean);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(data: {
    course: CourseBasicInfo;
    contact: ContactInfo;
    images: CourseImages;
  }): number {
    let score = 0;
    let maxScore = 0;

    // Course data
    const courseFields = ['name', 'description', 'architect'];
    courseFields.forEach(field => {
      maxScore += 10;
      if (data.course[field as keyof CourseBasicInfo]) {
        score += 10;
      }
    });

    // Contact data
    const contactFields = ['phone', 'email'];
    contactFields.forEach(field => {
      maxScore += 10;
      if (data.contact[field as keyof ContactInfo]) {
        score += 10;
      }
    });

    // Images
    maxScore += 20;
    if (data.images.hero && data.images.hero.length > 0) score += 10;
    if (data.images.gallery && data.images.gallery.length > 0) score += 10;

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Return page to pool
   */
  private async returnPage(sessionId: string, page: Page): Promise<void> {
    for (const [pageId, pageSession] of this.pages) {
      if (pageSession.page === page && pageSession.sessionId === sessionId) {
        pageSession.busy = false;
        pageSession.lastUsed = new Date();
        break;
      }
    }
  }

  /**
   * Close page
   */
  private async closePage(pageId: string): Promise<void> {
    const pageSession = this.pages.get(pageId);
    if (pageSession) {
      try {
        await pageSession.page.close();
      } catch (error) {
        scrapingLogger.warn(`Error closing page ${pageId}`, error);
      }
      this.pages.delete(pageId);
    }
  }

  /**
   * Close browser session
   */
  private async closeBrowserSession(sessionId: string): Promise<void> {
    const session = this.browsers.get(sessionId);
    if (session) {
      try {
        // Close all pages first
        for (const [pageId, pageSession] of this.pages) {
          if (pageSession.sessionId === sessionId) {
            await this.closePage(pageId);
          }
        }

        // Close browser
        await session.browser.close();
      } catch (error) {
        scrapingLogger.warn(`Error closing browser session ${sessionId}`, error);
      }
      this.browsers.delete(sessionId);

      scrapingLogger.info(`Closed browser session ${sessionId}`);
    }
  }

  /**
   * Cleanup old sessions
   */
  private async cleanupSessions(): Promise<void> {
    const now = Date.now();

    // Cleanup old pages
    for (const [pageId, pageSession] of this.pages) {
      if (now - pageSession.lastUsed.getTime() > this.sessionTimeout) {
        await this.closePage(pageId);
      }
    }

    // Cleanup old browsers
    for (const [sessionId, session] of this.browsers) {
      if (now - session.lastUsed.getTime() > this.sessionTimeout) {
        await this.closeBrowserSession(sessionId);
      }
    }
  }

  /**
   * Handle and classify errors
   */
  private handleError(error: any, url: string): ScrapingError {
    if (error instanceof NetworkError) {
      return {
        type: 'network',
        code: error.statusCode?.toString(),
        message: error.message,
        url,
        statusCode: error.statusCode,
        retryable: error.statusCode !== 404 && error.statusCode !== 403,
      };
    }

    if (error.name === 'TimeoutError') {
      return {
        type: 'timeout',
        message: 'Operation timeout',
        url,
        retryable: true,
      };
    }

    if (error.message?.includes('JavaScript')) {
      return {
        type: 'javascript',
        message: error.message,
        url,
        retryable: false,
      };
    }

    return {
      type: 'network',
      message: error.message || 'Unknown error',
      url,
      retryable: true,
    };
  }

  /**
   * Cleanup resources on shutdown
   */
  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all browser sessions
    const sessionIds = Array.from(this.browsers.keys());
    await Promise.all(sessionIds.map(id => this.closeBrowserSession(id)));

    scrapingLogger.info('Dynamic scraper cleanup completed');
  }
}