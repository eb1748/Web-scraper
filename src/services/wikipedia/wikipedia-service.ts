import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import type {
  WikipediaSearchResponse,
  WikipediaPageResponse,
  WikidataResponse,
  WikipediaData,
  APIResponse,
  APIError,
} from '../../types/api.types';
import { apiLogger } from '../../utils/logger';
import config from '../../config/config';

export class WikipediaService {
  private readonly wikipediaBaseUrl = 'https://en.wikipedia.org/api/rest_v1';
  private readonly wikidataUrl = 'https://www.wikidata.org/w/api.php';
  private readonly searchUrl = 'https://en.wikipedia.org/w/api.php';
  private readonly timeout: number;
  private requestCount = 0;
  private lastReset = Date.now();

  constructor() {
    this.timeout = config.scraping.timeoutMs;
    apiLogger.info('WikipediaService initialized');
  }

  /**
   * Search for golf course articles on Wikipedia
   */
  async searchCourseArticle(
    courseName: string,
    location: string
  ): Promise<APIResponse<string | null>> {
    const requestId = `wiki-search-${Date.now()}`;
    const startTime = Date.now();

    try {
      await this.checkRateLimit();

      // Create multiple search queries with different combinations
      const searchQueries = [
        `"${courseName}" golf course ${location}`,
        `"${courseName}" golf ${location}`,
        `${courseName} golf course`,
        `${courseName} ${location} golf`,
      ];

      apiLogger.info(`Searching Wikipedia for golf course: ${courseName}`, {
        requestId,
        location,
        searchQueries: searchQueries.length,
      });

      for (const query of searchQueries) {
        const searchParams = {
          action: 'query',
          format: 'json',
          list: 'search',
          srsearch: query,
          srlimit: 10,
          srprop: 'snippet|titlesnippet|size|wordcount',
        };

        const response: AxiosResponse<WikipediaSearchResponse> = await axios.get(
          this.searchUrl,
          {
            params: searchParams,
            timeout: this.timeout,
            headers: {
              'User-Agent': config.scraping.userAgent,
            },
          }
        );

        this.incrementRequestCount();

        // Filter and validate search results
        const relevantArticle = this.findMostRelevantArticle(
          response.data.query.search,
          courseName,
          location
        );

        if (relevantArticle) {
          const processingTime = Date.now() - startTime;

          apiLogger.info(`Found relevant Wikipedia article: ${relevantArticle}`, {
            requestId,
            processingTime,
            query,
            courseName,
          });

          return {
            success: true,
            data: relevantArticle,
            cached: false,
            requestId,
            processingTime,
          };
        }

        // Small delay between search attempts
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // No relevant article found
      const processingTime = Date.now() - startTime;

      apiLogger.info(`No Wikipedia article found for: ${courseName}`, {
        requestId,
        processingTime,
        location,
      });

      return {
        success: true,
        data: null,
        cached: false,
        requestId,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const apiError = this.createAPIError('searchCourseArticle', error);

      apiLogger.error('Failed to search Wikipedia for course article', error, {
        requestId,
        courseName,
        location,
        processingTime,
      });

      return {
        success: false,
        error: apiError,
        cached: false,
        requestId,
        processingTime,
      };
    }
  }

  /**
   * Extract comprehensive course data from Wikipedia article
   */
  async extractCourseData(articleTitle: string): Promise<APIResponse<WikipediaData>> {
    const requestId = `wiki-extract-${Date.now()}`;
    const startTime = Date.now();

    try {
      await this.checkRateLimit();

      apiLogger.info(`Extracting course data from Wikipedia article: ${articleTitle}`, {
        requestId,
      });

      // Fetch both article content and Wikidata information in parallel
      const [contentResult, wikidataResult] = await Promise.all([
        this.getArticleContent(articleTitle),
        this.getWikidataInfo(articleTitle),
      ]);

      if (!contentResult.success) {
        return {
          success: false,
          error: contentResult.error,
          cached: false,
          requestId,
          processingTime: Date.now() - startTime,
        };
      }

      // Combine and process the data
      const wikipediaData = this.combineWikipediaData(
        contentResult.data!,
        wikidataResult.data
      );

      const processingTime = Date.now() - startTime;

      apiLogger.info(`Successfully extracted course data from Wikipedia`, {
        requestId,
        processingTime,
        articleTitle,
        architect: wikipediaData.architect,
        openingYear: wikipediaData.openingYear,
        championships: wikipediaData.majorChampionships.length,
      });

      return {
        success: true,
        data: wikipediaData,
        cached: false,
        requestId,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const apiError = this.createAPIError('extractCourseData', error);

      apiLogger.error('Failed to extract course data from Wikipedia', error, {
        requestId,
        articleTitle,
        processingTime,
      });

      return {
        success: false,
        error: apiError,
        cached: false,
        requestId,
        processingTime,
      };
    }
  }

  /**
   * Get article content from Wikipedia
   */
  private async getArticleContent(title: string): Promise<APIResponse<string>> {
    try {
      await this.checkRateLimit();

      const response: AxiosResponse<WikipediaPageResponse> = await axios.get(
        `${this.wikipediaBaseUrl}/page/html/${encodeURIComponent(title)}`,
        {
          timeout: this.timeout,
          headers: {
            'User-Agent': config.scraping.userAgent,
          },
        }
      );

      this.incrementRequestCount();

      return {
        success: true,
        data: response.data.toString(),
        cached: false,
        requestId: `content-${Date.now()}`,
        processingTime: 0,
      };

    } catch (error) {
      apiLogger.warn(`Failed to fetch article content for: ${title}`, error);

      // Try alternative API endpoint
      try {
        const params = {
          action: 'parse',
          format: 'json',
          page: title,
          prop: 'text|categories|sections',
          disableeditsection: 1,
        };

        const response: AxiosResponse<WikipediaPageResponse> = await axios.get(
          this.searchUrl,
          {
            params,
            timeout: this.timeout,
            headers: {
              'User-Agent': config.scraping.userAgent,
            },
          }
        );

        this.incrementRequestCount();

        return {
          success: true,
          data: response.data.parse.text['*'],
          cached: false,
          requestId: `content-alt-${Date.now()}`,
          processingTime: 0,
        };

      } catch (altError) {
        return {
          success: false,
          error: this.createAPIError('getArticleContent', altError),
          cached: false,
          requestId: `content-error-${Date.now()}`,
          processingTime: 0,
        };
      }
    }
  }

  /**
   * Get structured data from Wikidata
   */
  private async getWikidataInfo(title: string): Promise<APIResponse<any>> {
    try {
      await this.checkRateLimit();

      // First, get the Wikidata entity ID for the Wikipedia page
      const wikidataParams = {
        action: 'wbgetentities',
        format: 'json',
        sites: 'enwiki',
        titles: title,
        props: 'claims|labels|descriptions',
      };

      const response: AxiosResponse<WikidataResponse> = await axios.get(
        this.wikidataUrl,
        {
          params: wikidataParams,
          timeout: this.timeout,
          headers: {
            'User-Agent': config.scraping.userAgent,
          },
        }
      );

      this.incrementRequestCount();

      return {
        success: true,
        data: response.data,
        cached: false,
        requestId: `wikidata-${Date.now()}`,
        processingTime: 0,
      };

    } catch (error) {
      apiLogger.warn(`Failed to fetch Wikidata for: ${title}`, error);

      return {
        success: false,
        error: this.createAPIError('getWikidataInfo', error),
        cached: false,
        requestId: `wikidata-error-${Date.now()}`,
        processingTime: 0,
      };
    }
  }

  /**
   * Find the most relevant article from search results
   */
  private findMostRelevantArticle(
    searchResults: any[],
    courseName: string,
    location: string
  ): string | null {
    if (!searchResults || searchResults.length === 0) {
      return null;
    }

    // Score each result based on relevance
    const scoredResults = searchResults.map(result => {
      let score = 0;
      const title = result.title.toLowerCase();
      const snippet = result.snippet.toLowerCase();
      const courseNameLower = courseName.toLowerCase();
      const locationLower = location.toLowerCase();

      // High score for exact course name match in title
      if (title.includes(courseNameLower)) {
        score += 50;
      }

      // Medium score for partial course name match
      const courseWords = courseNameLower.split(' ');
      courseWords.forEach(word => {
        if (word.length > 2 && title.includes(word)) {
          score += 15;
        }
      });

      // Score for golf-related terms
      if (title.includes('golf course') || title.includes('golf club')) {
        score += 30;
      } else if (title.includes('golf')) {
        score += 20;
      }

      // Score for location match
      if (title.includes(locationLower) || snippet.includes(locationLower)) {
        score += 25;
      }

      // Penalty for disambiguation pages
      if (title.includes('disambiguation')) {
        score -= 50;
      }

      // Penalty for list pages
      if (title.includes('list of') || title.includes('category:')) {
        score -= 30;
      }

      // Bonus for longer, more detailed articles
      if (result.wordcount > 1000) {
        score += 10;
      }

      return { ...result, score };
    });

    // Sort by score and return the best match
    const bestMatch = scoredResults
      .filter(result => result.score > 20) // Minimum relevance threshold
      .sort((a, b) => b.score - a.score)[0];

    return bestMatch ? bestMatch.title : null;
  }

  /**
   * Combine Wikipedia content and Wikidata information
   */
  private combineWikipediaData(htmlContent: string, wikidataResponse?: any): WikipediaData {
    const $ = cheerio.load(htmlContent);

    // Initialize result with defaults
    const result: WikipediaData = {
      summary: '',
      history: '',
      architect: '',
      openingYear: 0,
      majorChampionships: [],
      notableEvents: [],
      references: [],
      coordinates: undefined,
      images: [],
      lastUpdated: new Date(),
    };

    try {
      // Extract summary (first paragraph)
      const firstParagraph = $('p').first().text().trim();
      result.summary = this.cleanText(firstParagraph);

      // Extract architect information
      result.architect = this.extractArchitectInfo($, htmlContent);

      // Extract opening year
      result.openingYear = this.extractOpeningYear($, htmlContent);

      // Extract major championships
      result.majorChampionships = this.extractMajorChampionships($, htmlContent);

      // Extract notable events
      result.notableEvents = this.extractNotableEvents($, htmlContent);

      // Extract references
      result.references = this.extractReferences($);

      // Extract images
      result.images = this.extractImages($);

      // Extract history section
      result.history = this.extractHistorySection($);

      // Enhance with Wikidata if available
      if (wikidataResponse && wikidataResponse.entities) {
        this.enhanceWithWikidata(result, wikidataResponse);
      }

    } catch (error) {
      apiLogger.warn('Error processing Wikipedia content', error);
    }

    return result;
  }

  /**
   * Extract architect information from content
   */
  private extractArchitectInfo($: cheerio.CheerioAPI, htmlContent: string): string {
    const architectPatterns = [
      /designed by ([^.]+)/i,
      /architect[s]?[:\s]+([^.]+)/i,
      /course architect[s]?[:\s]+([^.]+)/i,
      /golf course architect[s]?[:\s]+([^.]+)/i,
    ];

    // Check infobox first
    const infoboxArchitect = $('.infobox tr').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('architect') || text.includes('designer');
    }).find('td').last().text().trim();

    if (infoboxArchitect && infoboxArchitect.length > 0) {
      return this.cleanArchitectName(infoboxArchitect);
    }

    // Search through text content
    const textContent = $.text();
    for (const pattern of architectPatterns) {
      const match = textContent.match(pattern);
      if (match && match[1]) {
        return this.cleanArchitectName(match[1]);
      }
    }

    return '';
  }

  /**
   * Extract opening year from content
   */
  private extractOpeningYear($: cheerio.CheerioAPI, htmlContent: string): number {
    const yearPatterns = [
      /opened in (\d{4})/i,
      /established in (\d{4})/i,
      /built in (\d{4})/i,
      /constructed in (\d{4})/i,
      /founded in (\d{4})/i,
    ];

    // Check infobox first
    const infoboxOpened = $('.infobox tr').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('opened') || text.includes('established') || text.includes('built');
    }).find('td').last().text().trim();

    if (infoboxOpened) {
      const yearMatch = infoboxOpened.match(/(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1], 10);
        if (year >= 1800 && year <= new Date().getFullYear()) {
          return year;
        }
      }
    }

    // Search through text content
    const textContent = $.text();
    for (const pattern of yearPatterns) {
      const match = textContent.match(pattern);
      if (match && match[1]) {
        const year = parseInt(match[1], 10);
        if (year >= 1800 && year <= new Date().getFullYear()) {
          return year;
        }
      }
    }

    return 0;
  }

  /**
   * Extract major championships from content
   */
  private extractMajorChampionships($: cheerio.CheerioAPI, htmlContent: string): string[] {
    const championships: string[] = [];
    const majorChampionships = [
      'masters tournament',
      'u.s. open',
      'us open',
      'open championship',
      'the open',
      'pga championship',
      'players championship',
      'ryder cup',
      'presidents cup',
      'solheim cup',
    ];

    const textContent = $.text().toLowerCase();

    majorChampionships.forEach(championship => {
      if (textContent.includes(championship)) {
        // Try to extract years
        const pattern = new RegExp(`${championship}[^.]*?(\\d{4}(?:,\\s*\\d{4})*)`, 'gi');
        const match = textContent.match(pattern);
        if (match) {
          championships.push(`${championship} (${match[0].match(/\d{4}/g)?.join(', ') || 'year unknown'})`);
        } else {
          championships.push(championship);
        }
      }
    });

    return [...new Set(championships)]; // Remove duplicates
  }

  /**
   * Extract notable events from content
   */
  private extractNotableEvents($: cheerio.CheerioAPI, htmlContent: string): string[] {
    const events: string[] = [];

    // Look for tournament sections
    $('h2, h3').each((_, el) => {
      const heading = $(el).text().toLowerCase();
      if (heading.includes('tournament') || heading.includes('championship') ||
          heading.includes('event') || heading.includes('history')) {

        const section = $(el).nextUntil('h2, h3').text();
        const eventMatches = section.match(/(\d{4}[^.]*(?:tournament|championship|cup|open)[^.]*)/gi);

        if (eventMatches) {
          events.push(...eventMatches.slice(0, 5)); // Limit to 5 events per section
        }
      }
    });

    return events.slice(0, 10); // Limit total events
  }

  /**
   * Extract references from content
   */
  private extractReferences($: cheerio.CheerioAPI): string[] {
    const references: string[] = [];

    $('.reflist a[href^="http"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.includes('wikipedia.org')) {
        references.push(href);
      }
    });

    return references.slice(0, 10); // Limit to 10 references
  }

  /**
   * Extract images from content
   */
  private extractImages($: cheerio.CheerioAPI): string[] {
    const images: string[] = [];

    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('upload.wikimedia.org')) {
        // Convert to higher resolution if possible
        const highResSrc = src.replace(/\/thumb\//, '/').replace(/\/\d+px-[^/]+$/, '');
        images.push(highResSrc.startsWith('//') ? `https:${highResSrc}` : highResSrc);
      }
    });

    return [...new Set(images)].slice(0, 5); // Remove duplicates and limit to 5 images
  }

  /**
   * Extract history section
   */
  private extractHistorySection($: cheerio.CheerioAPI): string {
    const historyHeading = $('h2, h3').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('history') || text.includes('background') || text.includes('development');
    }).first();

    if (historyHeading.length) {
      const historyContent = historyHeading.nextUntil('h2, h3').text();
      return this.cleanText(historyContent).substring(0, 1000); // Limit to 1000 chars
    }

    return '';
  }

  /**
   * Enhance data with Wikidata information
   */
  private enhanceWithWikidata(result: WikipediaData, wikidataResponse: any): void {
    try {
      const entities = Object.values(wikidataResponse.entities);
      if (entities.length === 0) return;

      const entity = entities[0] as any;
      if (!entity.claims) return;

      // Extract coordinates (P625)
      if (entity.claims.P625 && entity.claims.P625[0]?.mainsnak?.datavalue?.value) {
        const coords = entity.claims.P625[0].mainsnak.datavalue.value;
        result.coordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
      }

      // Extract opening date (P571) if not already found
      if (!result.openingYear && entity.claims.P571 && entity.claims.P571[0]?.mainsnak?.datavalue?.value) {
        const date = entity.claims.P571[0].mainsnak.datavalue.value.time;
        const yearMatch = date.match(/(\d{4})/);
        if (yearMatch) {
          result.openingYear = parseInt(yearMatch[1], 10);
        }
      }

    } catch (error) {
      apiLogger.warn('Error enhancing with Wikidata', error);
    }
  }

  /**
   * Clean and standardize text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\[edit\]/g, '')
      .replace(/\[\d+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clean architect name
   */
  private cleanArchitectName(name: string): string {
    return name
      .replace(/\([^)]*\)/g, '') // Remove parentheses
      .replace(/\[\d+\]/g, '') // Remove reference numbers
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Rate limiting for Wikipedia (200 requests per minute)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const minutesPassed = (now - this.lastReset) / 60000;

    if (minutesPassed >= 1) {
      this.requestCount = 0;
      this.lastReset = now;
    }

    if (this.requestCount >= config.api.wikipediaRateLimit) {
      const waitTime = 60000 - (now - this.lastReset);
      if (waitTime > 0) {
        apiLogger.warn(`Wikipedia rate limit reached, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.lastReset = Date.now();
      }
    }
  }

  /**
   * Increment request counter
   */
  private incrementRequestCount(): void {
    this.requestCount++;
  }

  /**
   * Create standardized API error
   */
  private createAPIError(endpoint: string, error: any): APIError {
    return {
      service: 'wikipedia',
      endpoint,
      statusCode: error.response?.status,
      message: error.message || 'Unknown Wikipedia API error',
      originalError: error,
      timestamp: new Date(),
      retryable: !error.response || error.response.status >= 500,
    };
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    rateLimitStatus: {
      remaining: number;
      resetTime: Date;
      withinLimits: boolean;
    };
  } {
    const remaining = Math.max(0, config.api.wikipediaRateLimit - this.requestCount);
    const withinLimits = remaining > 10; // Consider healthy if we have more than 10 requests left

    return {
      status: withinLimits ? 'healthy' : 'degraded',
      rateLimitStatus: {
        remaining,
        resetTime: new Date(this.lastReset + 60000),
        withinLimits,
      },
    };
  }
}