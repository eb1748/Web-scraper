import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { parse } from 'node-html-parser';
import UserAgent from 'user-agents';
import type {
  ScrapingTarget,
  ScrapingOptions,
  CourseBasicInfo,
  ContactInfo,
  CourseImages,
  ScrapingResult,
  ScrapingError,
  ProcessingResult,
  ExtractionSelectors,
} from '../../types/scraping.types';
import { scrapingLogger } from '../../utils/logger';
import { NetworkError, ParseError, ScrapingError as CustomScrapingError } from '../../utils/errors';
import config from '../../config/config';

export class StaticContentScraper {
  private axios: AxiosInstance;
  private readonly timeout: number;
  private readonly userAgent: string;

  constructor() {
    this.timeout = config.scraping.requestDelayMs * 15; // 30 seconds default
    this.userAgent = config.scraping.userAgent;

    this.axios = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept 4xx as valid responses
    });

    // Add request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        scrapingLogger.logScraping(config.url!, 'start', {
          method: config.method?.toUpperCase(),
          headers: config.headers,
        });
        return config;
      },
      (error) => {
        scrapingLogger.error('Request interceptor error', error);
        return Promise.reject(error);
      },
    );

    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      (response) => {
        scrapingLogger.logScraping(response.config.url!, 'success', {
          status: response.status,
          size: response.data?.length || 0,
          responseTime: Date.now() - parseInt(response.config.metadata?.startTime || '0'),
        });
        return response;
      },
      (error) => {
        const url = error.config?.url || 'unknown';
        scrapingLogger.logScraping(url, 'failure', {
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Main scraping method for static content
   */
  async scrapeBasicInfo(
    target: ScrapingTarget,
    options?: Partial<ScrapingOptions>,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const requestId = `static-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      scrapingLogger.info(`Starting static scraping for ${target.name}`, {
        url: target.url,
        requestId,
      });

      // Fetch HTML content
      const response = await this.fetchContent(target.url, options);

      // Parse HTML
      const $ = cheerio.load(response.data);
      const htmlRoot = parse(response.data);

      // Extract structured data
      const courseData = await this.extractCourseData($, htmlRoot, target);
      const contactInfo = await this.extractContactInfo($, htmlRoot);
      const images = await this.extractImages($, htmlRoot, target.url);

      // Combine all extracted data
      const combinedData: CourseBasicInfo = {
        ...courseData,
        ...contactInfo,
        images: [...(images.hero || []), ...(images.gallery || [])],
        source: target.url,
        extractedAt: new Date(),
        confidence: this.calculateConfidence(courseData, contactInfo, images),
      };

      const processingTime = Date.now() - startTime;

      scrapingLogger.info(`Static scraping completed for ${target.name}`, {
        requestId,
        processingTime,
        confidence: combinedData.confidence,
      });

      return {
        success: true,
        data: combinedData,
        images,
        contact: contactInfo,
        errors: [],
        warnings: [],
        processingTime,
        confidence: combinedData.confidence,
        source: target.url,
        metadata: {
          method: 'static',
          screenshots: [],
          finalUrl: response.request?.responseURL || target.url,
          redirects: this.getRedirectChain(response),
          responseSize: response.data.length,
          resourcesLoaded: 1,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const scrapingError = this.handleError(error, target.url);

      scrapingLogger.error(`Static scraping failed for ${target.name}`, error, {
        requestId,
        processingTime,
        errorType: scrapingError.type,
      });

      return {
        success: false,
        errors: [scrapingError],
        warnings: [],
        processingTime,
        confidence: 0,
        source: target.url,
        metadata: {
          method: 'static',
          screenshots: [],
          finalUrl: target.url,
          redirects: [],
          responseSize: 0,
          resourcesLoaded: 0,
        },
      };
    }
  }

  /**
   * Fetch HTML content with proper error handling
   */
  private async fetchContent(
    url: string,
    options?: Partial<ScrapingOptions>,
  ): Promise<AxiosResponse> {
    const requestOptions = {
      url,
      method: 'GET' as const,
      timeout: options?.timeout || this.timeout,
      headers: {
        ...this.axios.defaults.headers,
        'User-Agent': options?.userAgent || this.userAgent,
        ...options?.headers,
      },
      metadata: {
        startTime: Date.now().toString(),
      },
    };

    try {
      const response = await this.axios(requestOptions);

      if (response.status >= 400) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          url,
          'GET',
          response.status,
        );
      }

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new NetworkError('Request timeout', url, 'GET');
        }
        if (error.response) {
          throw new NetworkError(
            `HTTP ${error.response.status}: ${error.response.statusText}`,
            url,
            'GET',
            error.response.status,
          );
        }
        if (error.request) {
          throw new NetworkError('Network error - no response received', url, 'GET');
        }
      }
      throw new NetworkError(`Request failed: ${error.message}`, url, 'GET');
    }
  }

  /**
   * Extract course data using selectors and intelligent parsing
   */
  private async extractCourseData(
    $: cheerio.CheerioAPI,
    htmlRoot: any,
    target: ScrapingTarget,
  ): Promise<Partial<CourseBasicInfo>> {
    const data: Partial<CourseBasicInfo> = {
      name: target.name, // Fallback to target name
    };

    try {
      // Extract course name
      data.name =
        this.extractField($, [
          'h1',
          '.course-name',
          '.page-title',
          'title',
          '[data-testid="course-name"]',
          ...(target.selectors?.courseName || []),
        ]) || target.name;

      // Extract description
      data.description = this.extractField($, [
        '.course-description',
        '.about-course',
        '.course-overview',
        'meta[name="description"]',
        '.description',
        'p:contains("golf")',
        ...(target.selectors?.description || []),
      ]);

      // Extract architect
      data.architect = this.extractField($, [
        '.architect',
        '.designer',
        ':contains("designed by")',
        ':contains("architect")',
        ...(target.selectors?.architect || []),
      ]);

      // Extract opening year
      const yearText = this.extractField($, [
        '.opening-year',
        '.established',
        ':contains("opened")',
        ':contains("built")',
        ':contains("established")',
        ...(target.selectors?.openingYear || []),
      ]);
      if (yearText) {
        const yearMatch = yearText.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          data.openingYear = parseInt(yearMatch[0]);
        }
      }

      // Extract yardage
      const yardageText = this.extractField($, [
        '.yardage',
        '.total-yardage',
        ':contains("yards")',
        ':contains("yardage")',
        ...(target.selectors?.yardage || []),
      ]);
      if (yardageText) {
        const yardageMatch = yardageText.match(/\b(\d{4,5})\b/);
        if (yardageMatch) {
          data.totalYardage = parseInt(yardageMatch[0]);
        }
      }

      // Extract par
      const parText = this.extractField($, [
        '.par',
        '.course-par',
        ':contains("par")',
        ...(target.selectors?.par || []),
      ]);
      if (parText) {
        const parMatch = parText.match(/\bpar\s*(\d{2})\b/i);
        if (parMatch) {
          data.parScore = parseInt(parMatch[1]);
        }
      }

      // Extract number of holes
      const holesText = this.extractField($, [
        '.holes',
        '.course-holes',
        ':contains("holes")',
        ':contains("18")',
        ...(target.selectors?.holes || []),
      ]);
      if (holesText) {
        const holesMatch = holesText.match(/\b(\d{1,2})\s*holes?\b/i);
        if (holesMatch) {
          data.numberOfHoles = parseInt(holesMatch[1]);
        }
      } else {
        data.numberOfHoles = 18; // Default assumption
      }

      // Extract pricing
      data.greensFeePriceRange = this.extractField($, [
        '.pricing',
        '.green-fees',
        '.rates',
        ':contains("$")',
        ':contains("price")',
        ':contains("fee")',
        ...(target.selectors?.pricing || []),
      ]);

      // Clean up extracted data
      this.cleanExtractedData(data);

      return data;
    } catch (error) {
      scrapingLogger.error('Error extracting course data', error, { url: target.url });
      return data;
    }
  }

  /**
   * Extract contact information
   */
  private async extractContactInfo($: cheerio.CheerioAPI, htmlRoot: any): Promise<ContactInfo> {
    const contact: ContactInfo = {};

    try {
      // Extract phone number
      contact.phone = this.extractField($, [
        'a[href^="tel:"]',
        '.phone',
        '.contact-phone',
        ':contains("phone")',
        ':contains("call")',
      ]);

      // Clean phone number
      if (contact.phone) {
        const phoneMatch = contact.phone.match(/[\d\s\-\(\)\.]{10,}/);
        if (phoneMatch) {
          contact.phone = phoneMatch[0].trim();
        }
      }

      // Extract email
      contact.email = this.extractField($, [
        'a[href^="mailto:"]',
        '.email',
        '.contact-email',
        ':contains("@")',
      ]);

      // Clean email
      if (contact.email) {
        const emailMatch = contact.email.match(
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        );
        if (emailMatch) {
          contact.email = emailMatch[0];
        }
      }

      // Extract address
      contact.address = this.extractField($, [
        '.address',
        '.location',
        '.contact-address',
        'address',
        '.venue-address',
      ]);

      // Extract website (canonical or alternate links)
      contact.website = this.extractField(
        $,
        ['link[rel="canonical"]', 'meta[property="og:url"]', '.website', 'a[href*="golf"]'],
        'href',
      );

      // Extract booking URL
      contact.bookingUrl = this.extractField(
        $,
        [
          'a[href*="booking"]',
          'a[href*="tee-time"]',
          'a[href*="reserve"]',
          'a:contains("book")',
          'a:contains("tee time")',
        ],
        'href',
      );

      return contact;
    } catch (error) {
      scrapingLogger.error('Error extracting contact info', error);
      return contact;
    }
  }

  /**
   * Extract images from the page
   */
  private async extractImages(
    $: cheerio.CheerioAPI,
    htmlRoot: any,
    baseUrl: string,
  ): Promise<CourseImages> {
    const images: CourseImages = {
      hero: [],
      gallery: [],
      courseMap: [],
      aerial: [],
      amenities: [],
    };

    try {
      // Extract hero images
      const heroSelectors = [
        '.hero img',
        '.banner img',
        '.main-image img',
        '.course-image img',
        'img[alt*="golf"]',
      ];

      heroSelectors.forEach((selector) => {
        $(selector).each((_, element) => {
          const src = $(element).attr('src') || $(element).attr('data-src');
          if (src) {
            const absoluteUrl = this.resolveUrl(src, baseUrl);
            if (absoluteUrl && !images.hero!.includes(absoluteUrl)) {
              images.hero!.push(absoluteUrl);
            }
          }
        });
      });

      // Extract gallery images
      const gallerySelectors = [
        '.gallery img',
        '.photo-gallery img',
        '.course-photos img',
        '.slideshow img',
        '[class*="gallery"] img',
      ];

      gallerySelectors.forEach((selector) => {
        $(selector).each((_, element) => {
          const src = $(element).attr('src') || $(element).attr('data-src');
          if (src) {
            const absoluteUrl = this.resolveUrl(src, baseUrl);
            if (absoluteUrl && !images.gallery!.includes(absoluteUrl)) {
              images.gallery!.push(absoluteUrl);
            }
          }
        });
      });

      // Extract course map images
      const mapSelectors = [
        'img[alt*="map"]',
        'img[alt*="layout"]',
        'img[alt*="scorecard"]',
        '.course-map img',
        '.layout img',
      ];

      mapSelectors.forEach((selector) => {
        $(selector).each((_, element) => {
          const src = $(element).attr('src') || $(element).attr('data-src');
          if (src) {
            const absoluteUrl = this.resolveUrl(src, baseUrl);
            if (absoluteUrl && !images.courseMap!.includes(absoluteUrl)) {
              images.courseMap!.push(absoluteUrl);
            }
          }
        });
      });

      // Limit images to prevent excessive data
      images.hero = images.hero!.slice(0, 3);
      images.gallery = images.gallery!.slice(0, 10);
      images.courseMap = images.courseMap!.slice(0, 2);

      return images;
    } catch (error) {
      scrapingLogger.error('Error extracting images', error);
      return images;
    }
  }

  /**
   * Extract field value using multiple selectors
   */
  private extractField(
    $: cheerio.CheerioAPI,
    selectors: string[],
    attribute?: string,
  ): string | undefined {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        let value: string;

        if (attribute) {
          value = element.attr(attribute) || '';
        } else if (selector.includes('[content]') || selector.includes('meta')) {
          value = element.attr('content') || element.text() || '';
        } else {
          value = element.text() || '';
        }

        value = value.trim();
        if (value && value.length > 0) {
          return value;
        }
      }
    }
    return undefined;
  }

  /**
   * Clean and normalize extracted data
   */
  private cleanExtractedData(data: Partial<CourseBasicInfo>): void {
    // Clean name
    if (data.name) {
      data.name = data.name.replace(/\s+/g, ' ').trim();
    }

    // Clean description
    if (data.description) {
      data.description = data.description.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();

      // Limit description length
      if (data.description.length > 500) {
        data.description = data.description.substring(0, 497) + '...';
      }
    }

    // Clean architect name
    if (data.architect) {
      data.architect = data.architect
        .replace(/designed\s+by\s*/i, '')
        .replace(/architect:?\s*/i, '')
        .trim();
    }

    // Clean pricing
    if (data.greensFeePriceRange) {
      data.greensFeePriceRange = data.greensFeePriceRange
        .replace(/green\s*fees?:?\s*/i, '')
        .replace(/rates?:?\s*/i, '')
        .trim();
    }
  }

  /**
   * Calculate confidence score based on extracted data
   */
  private calculateConfidence(
    courseData: Partial<CourseBasicInfo>,
    contactInfo: ContactInfo,
    images: CourseImages,
  ): number {
    let score = 0;
    let maxScore = 0;

    // Course data scoring
    const courseFields = [
      'name',
      'description',
      'architect',
      'openingYear',
      'totalYardage',
      'parScore',
      'numberOfHoles',
    ];

    courseFields.forEach((field) => {
      maxScore += 10;
      if (courseData[field as keyof CourseBasicInfo]) {
        score += 10;
      }
    });

    // Contact info scoring
    const contactFields = ['phone', 'email', 'address', 'website'];
    contactFields.forEach((field) => {
      maxScore += 5;
      if (contactInfo[field as keyof ContactInfo]) {
        score += 5;
      }
    });

    // Images scoring
    maxScore += 20;
    if (images.hero && images.hero.length > 0) score += 10;
    if (images.gallery && images.gallery.length > 0) score += 5;
    if (images.courseMap && images.courseMap.length > 0) score += 5;

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Resolve relative URLs to absolute URLs
   */
  private resolveUrl(url: string, baseUrl: string): string | null {
    try {
      if (url.startsWith('http')) {
        return url;
      }

      const base = new URL(baseUrl);
      const resolved = new URL(url, base);
      return resolved.toString();
    } catch {
      return null;
    }
  }

  /**
   * Get redirect chain from response
   */
  private getRedirectChain(response: AxiosResponse): string[] {
    const redirects: string[] = [];
    if (response.request?._redirectable?._redirects) {
      response.request._redirectable._redirects.forEach((redirect: any) => {
        redirects.push(redirect.url);
      });
    }
    return redirects;
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

    if (error instanceof ParseError) {
      return {
        type: 'parsing',
        message: error.message,
        url,
        retryable: false,
      };
    }

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return {
          type: 'timeout',
          message: 'Request timeout',
          url,
          retryable: true,
        };
      }

      return {
        type: 'network',
        code: error.code,
        message: error.message,
        url,
        statusCode: error.response?.status,
        retryable: true,
      };
    }

    return {
      type: 'parsing',
      message: error.message || 'Unknown error',
      url,
      retryable: false,
    };
  }
}
