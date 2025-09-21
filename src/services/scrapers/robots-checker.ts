import axios from 'axios';
import robotsParser from 'robots-parser';
import * as URL from 'url-parse';
import type { RobotsDirective, RobotsCheckResult } from '../../types/scraping.types';
import { scrapingLogger } from '../../utils/logger';
import { NetworkError } from '../../utils/errors';
import config from '../../config/config';

interface CachedRobots {
  directive: RobotsDirective | null;
  timestamp: Date;
  url: string;
}

export class RobotsChecker {
  private robotsCache: Map<string, CachedRobots> = new Map();
  private readonly cacheExpiry: number = 24 * 60 * 60 * 1000; // 24 hours
  private readonly defaultCrawlDelay: number = 2000; // 2 seconds
  private readonly timeout: number = 10000; // 10 seconds

  constructor() {
    // Clean up cache periodically
    setInterval(
      () => {
        this.cleanupCache();
      },
      60 * 60 * 1000,
    ); // Every hour
  }

  /**
   * Check if scraping is allowed for a URL
   */
  async canScrape(
    url: string,
    userAgent: string = config.scraping.userAgent,
  ): Promise<RobotsCheckResult> {
    try {
      const parsedUrl = new URL(url);
      const domain = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
      const path = parsedUrl.pathname;

      scrapingLogger.debug(`Checking robots.txt for ${domain}`, {
        url,
        userAgent,
        path,
      });

      // Get robots.txt directive
      const directive = await this.getRobotsTxt(domain);

      if (!directive) {
        // No robots.txt found, assume allowed with default crawl delay
        return {
          allowed: true,
          crawlDelay: this.defaultCrawlDelay,
          reason: 'No robots.txt found',
          cacheHit: this.robotsCache.has(domain),
          checkedAt: new Date(),
        };
      }

      // Check if path is allowed
      const isAllowed = this.isPathAllowed(directive, path, userAgent);
      const crawlDelay = this.getCrawlDelay(directive, userAgent);

      const result: RobotsCheckResult = {
        allowed: isAllowed,
        crawlDelay: crawlDelay || this.defaultCrawlDelay,
        directive,
        cacheHit: this.robotsCache.has(domain),
        checkedAt: new Date(),
      };

      if (!isAllowed) {
        result.reason = `Path "${path}" is disallowed by robots.txt for user-agent "${userAgent}"`;
      }

      scrapingLogger.debug(`Robots.txt check result for ${url}`, {
        allowed: result.allowed,
        crawlDelay: result.crawlDelay,
        reason: result.reason,
        cacheHit: result.cacheHit,
      });

      return result;
    } catch (error) {
      scrapingLogger.error('Error checking robots.txt', error, { url, userAgent });

      // On error, be conservative but allow scraping with longer delay
      return {
        allowed: true,
        crawlDelay: this.defaultCrawlDelay * 2,
        reason: `Error checking robots.txt: ${error.message}`,
        cacheHit: false,
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Get robots.txt directive for a domain
   */
  async getRobotsTxt(domain: string): Promise<RobotsDirective | null> {
    try {
      // Check cache first
      const cached = this.robotsCache.get(domain);
      if (cached && Date.now() - cached.timestamp.getTime() < this.cacheExpiry) {
        scrapingLogger.debug(`Using cached robots.txt for ${domain}`);
        return cached.directive;
      }

      // Fetch robots.txt
      const robotsUrl = `${domain}/robots.txt`;
      scrapingLogger.debug(`Fetching robots.txt from ${robotsUrl}`);

      const response = await axios.get(robotsUrl, {
        timeout: this.timeout,
        headers: {
          'User-Agent': config.scraping.userAgent,
        },
        validateStatus: (status) => status < 500, // Accept 4xx as valid responses
      });

      let directive: RobotsDirective | null = null;

      if (response.status === 200 && response.data) {
        directive = this.parseRobotsTxt(response.data, robotsUrl);
        scrapingLogger.debug(`Successfully parsed robots.txt for ${domain}`, {
          userAgents: directive ? Object.keys(directive).length : 0,
        });
      } else {
        scrapingLogger.debug(`No robots.txt found for ${domain} (status: ${response.status})`);
      }

      // Cache the result (even if null)
      this.robotsCache.set(domain, {
        directive,
        timestamp: new Date(),
        url: robotsUrl,
      });

      return directive;
    } catch (error) {
      scrapingLogger.warn(`Failed to fetch robots.txt for ${domain}`, { error: error.message });

      // Cache null result to avoid repeated failed requests
      this.robotsCache.set(domain, {
        directive: null,
        timestamp: new Date(),
        url: `${domain}/robots.txt`,
      });

      return null;
    }
  }

  /**
   * Parse robots.txt content
   */
  private parseRobotsTxt(content: string, url: string): RobotsDirective | null {
    try {
      const robots = robotsParser(url, content);

      // Extract information for our user agent and generic rules
      const userAgents = ['*', config.scraping.userAgent, 'GolfCourseBot'];
      const directive: RobotsDirective = {
        userAgent: config.scraping.userAgent,
        allowed: [],
        disallowed: [],
        sitemap: [],
      };

      // Check each user agent for rules
      for (const userAgent of userAgents) {
        const isAllowed = (path: string) => robots.isAllowed(path, userAgent);
        const isDisallowed = (path: string) => robots.isDisallowed(path, userAgent);

        // Test common paths to understand the rules
        const testPaths = ['/', '/robots.txt', '/sitemap.xml', '/admin', '/private'];

        for (const path of testPaths) {
          if (isAllowed(path)) {
            if (!directive.allowed.includes(path)) {
              directive.allowed.push(path);
            }
          }
          if (isDisallowed(path)) {
            if (!directive.disallowed.includes(path)) {
              directive.disallowed.push(path);
            }
          }
        }

        // Get crawl delay
        const crawlDelay = robots.getCrawlDelay(userAgent);
        if (crawlDelay && !directive.crawlDelay) {
          directive.crawlDelay = crawlDelay * 1000; // Convert to milliseconds
        }
      }

      // Extract sitemap URLs
      const sitemapMatches = content.match(/^Sitemap:\s*(.+)$/gim);
      if (sitemapMatches) {
        directive.sitemap = sitemapMatches.map((match) =>
          match.replace(/^Sitemap:\s*/i, '').trim(),
        );
      }

      // Extract host directive
      const hostMatch = content.match(/^Host:\s*(.+)$/im);
      if (hostMatch) {
        directive.host = hostMatch[1].trim();
      }

      return directive;
    } catch (error) {
      scrapingLogger.error('Error parsing robots.txt', error, { url });
      return null;
    }
  }

  /**
   * Check if a path is allowed for a user agent
   */
  private isPathAllowed(directive: RobotsDirective, path: string, userAgent: string): boolean {
    try {
      // If no disallowed paths, assume allowed
      if (!directive.disallowed || directive.disallowed.length === 0) {
        return true;
      }

      // Check against disallowed patterns
      for (const disallowedPath of directive.disallowed) {
        if (this.matchesPattern(path, disallowedPath)) {
          // Check if there's a more specific allow rule
          if (directive.allowed) {
            for (const allowedPath of directive.allowed) {
              if (
                this.matchesPattern(path, allowedPath) &&
                allowedPath.length > disallowedPath.length
              ) {
                return true; // More specific allow rule takes precedence
              }
            }
          }
          return false;
        }
      }

      return true;
    } catch (error) {
      scrapingLogger.error('Error checking path allowance', error, { path, userAgent });
      return true; // Default to allowed on error
    }
  }

  /**
   * Get crawl delay for a user agent
   */
  private getCrawlDelay(directive: RobotsDirective, userAgent: string): number | null {
    return directive.crawlDelay || null;
  }

  /**
   * Check if a path matches a robots.txt pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Handle wildcards in robots.txt patterns
    if (pattern === '/') {
      return true; // Root pattern matches everything
    }

    if (pattern.endsWith('*')) {
      // Wildcard at the end
      const prefix = pattern.slice(0, -1);
      return path.startsWith(prefix);
    }

    if (pattern.includes('*')) {
      // Wildcard in the middle - convert to regex
      const regexPattern = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars
        .replace(/\\\*/g, '.*'); // Convert * to .*

      try {
        const regex = new RegExp(`^${regexPattern}`);
        return regex.test(path);
      } catch {
        // Fall back to simple string comparison
        return path.startsWith(pattern.replace('*', ''));
      }
    }

    // Exact match or prefix match
    return path.startsWith(pattern);
  }

  /**
   * Get comprehensive robots.txt information for a domain
   */
  async getRobotsInfo(domain: string): Promise<{
    exists: boolean;
    content?: string;
    directive?: RobotsDirective;
    sitemaps?: string[];
    crawlDelay?: number;
    lastChecked: Date;
  }> {
    try {
      const robotsUrl = `${domain}/robots.txt`;

      const response = await axios.get(robotsUrl, {
        timeout: this.timeout,
        headers: {
          'User-Agent': config.scraping.userAgent,
        },
        validateStatus: (status) => status < 500,
      });

      if (response.status === 200 && response.data) {
        const directive = this.parseRobotsTxt(response.data, robotsUrl);

        return {
          exists: true,
          content: response.data,
          directive: directive || undefined,
          sitemaps: directive?.sitemap,
          crawlDelay: directive?.crawlDelay,
          lastChecked: new Date(),
        };
      }

      return {
        exists: false,
        lastChecked: new Date(),
      };
    } catch (error) {
      scrapingLogger.error(`Error getting robots.txt info for ${domain}`, error);

      return {
        exists: false,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Clear cache for a specific domain
   */
  clearCache(domain?: string): void {
    if (domain) {
      this.robotsCache.delete(domain);
      scrapingLogger.debug(`Cleared robots.txt cache for ${domain}`);
    } else {
      this.robotsCache.clear();
      scrapingLogger.info('Cleared entire robots.txt cache');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    domains: string[];
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const domains = Array.from(this.robotsCache.keys());
    const entries = Array.from(this.robotsCache.values());

    const timestamps = entries.map((entry) => entry.timestamp);

    return {
      size: this.robotsCache.size,
      domains,
      oldestEntry:
        timestamps.length > 0
          ? new Date(Math.min(...timestamps.map((t) => t.getTime())))
          : undefined,
      newestEntry:
        timestamps.length > 0
          ? new Date(Math.max(...timestamps.map((t) => t.getTime())))
          : undefined,
    };
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [domain, cached] of this.robotsCache) {
      if (now - cached.timestamp.getTime() > this.cacheExpiry) {
        this.robotsCache.delete(domain);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      scrapingLogger.debug(`Cleaned up ${cleaned} expired robots.txt cache entries`);
    }
  }

  /**
   * Validate robots.txt content
   */
  validateRobotsTxt(content: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const lines = content.split('\n');
      let hasUserAgent = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === '' || line.startsWith('#')) {
          continue; // Skip empty lines and comments
        }

        if (line.toLowerCase().startsWith('user-agent:')) {
          hasUserAgent = true;
          const userAgent = line.substring(11).trim();
          if (!userAgent) {
            errors.push(`Line ${i + 1}: User-agent cannot be empty`);
          }
        } else if (line.toLowerCase().startsWith('disallow:')) {
          if (!hasUserAgent) {
            errors.push(`Line ${i + 1}: Disallow directive without preceding User-agent`);
          }
        } else if (line.toLowerCase().startsWith('allow:')) {
          if (!hasUserAgent) {
            errors.push(`Line ${i + 1}: Allow directive without preceding User-agent`);
          }
        } else if (line.toLowerCase().startsWith('crawl-delay:')) {
          const delay = line.substring(12).trim();
          if (isNaN(Number(delay))) {
            errors.push(`Line ${i + 1}: Invalid crawl-delay value "${delay}"`);
          }
        } else if (line.toLowerCase().startsWith('sitemap:')) {
          const sitemap = line.substring(8).trim();
          if (!sitemap.match(/^https?:\/\/.+/)) {
            warnings.push(`Line ${i + 1}: Sitemap URL may be invalid: "${sitemap}"`);
          }
        } else if (line.includes(':')) {
          warnings.push(`Line ${i + 1}: Unknown directive: "${line}"`);
        } else {
          warnings.push(`Line ${i + 1}: Invalid syntax: "${line}"`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to parse robots.txt: ${error.message}`],
        warnings: [],
      };
    }
  }
}
