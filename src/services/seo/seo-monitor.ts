import type {
  SEOMetrics,
  CoreWebVitals,
  SEOValidationResult,
  SEOIssue,
  SEORecommendation,
  StructuredDataSchema,
  SEOConfiguration
} from '../../types/seo.types';
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
import logger from '../../utils/logger';

/**
 * SEO Performance Monitor Service
 *
 * Monitors and analyzes SEO performance metrics including:
 * - Page load speed and Core Web Vitals
 * - Structured data validation
 * - Mobile usability testing
 * - SEO compliance scoring
 * - Performance recommendations
 */
export class SEOMonitor {
  private config: SEOConfiguration;
  private metricsCache = new Map<string, SEOMetrics>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(config: SEOConfiguration) {
    this.config = config;
  }

  /**
   * Analyze complete SEO performance for a page
   */
  async analyzePage(url: string, forceRefresh = false): Promise<SEOMetrics> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = this.getCachedMetrics(url);
        if (cached) {
          logger.debug('Returning cached SEO metrics', { url });
          return cached;
        }
      }

      logger.info('Analyzing SEO performance for page', { url });

      const [
        performanceMetrics,
        structuredDataValid,
        mobileUsable
      ] = await Promise.all([
        this.measurePagePerformance(url),
        this.validateStructuredData(url),
        this.testMobileUsability(url)
      ]);

      const metrics: SEOMetrics = {
        pageLoadSpeed: performanceMetrics.loadTime,
        coreWebVitals: performanceMetrics.vitals,
        structuredDataValidation: structuredDataValid,
        mobileUsability: mobileUsable,
        indexabilityScore: this.calculateIndexabilityScore(
          performanceMetrics,
          structuredDataValid,
          mobileUsable
        ),
        lastAnalyzed: new Date()
      };

      // Cache the results
      this.setCachedMetrics(url, metrics);

      logger.info('SEO analysis completed', {
        url,
        indexabilityScore: metrics.indexabilityScore,
        loadTime: metrics.pageLoadSpeed
      });

      return metrics;
    } catch (error) {
      logger.error('Error analyzing page SEO performance', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return fallback metrics
      return this.generateFallbackMetrics();
    }
  }

  /**
   * Measure page performance including Core Web Vitals
   */
  private async measurePagePerformance(url: string): Promise<{
    loadTime: number;
    vitals: CoreWebVitals;
  }> {
    // For server-side analysis, we'll simulate performance metrics
    // In a real implementation, this would use tools like Lighthouse or Puppeteer

    try {
      const startTime = Date.now();

      // Simulate page load analysis
      await this.simulatePageLoad(url);

      const loadTime = Date.now() - startTime;

      // Simulate Core Web Vitals measurement
      const vitals = await this.measureCoreWebVitals(url);

      return {
        loadTime,
        vitals
      };
    } catch (error) {
      logger.error('Error measuring page performance', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        loadTime: 5000, // Fallback to poor performance
        vitals: {
          lcp: 4000,
          fid: 300,
          cls: 0.25,
          fcp: 3000,
          ttfb: 1000
        }
      };
    }
  }

  /**
   * Measure Core Web Vitals for the page
   */
  private async measureCoreWebVitals(url: string): Promise<CoreWebVitals> {
    // In a browser environment, we would use the web-vitals library
    // For server-side, we'll simulate realistic values based on the URL

    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    const hasOptimizedImages = url.includes('webp') || url.includes('optimized');

    // Simulate realistic Core Web Vitals based on optimization indicators
    const baseMetrics = {
      lcp: isLocalhost ? 1200 : 2400, // Largest Contentful Paint
      fid: isLocalhost ? 50 : 100,   // First Input Delay
      cls: hasOptimizedImages ? 0.05 : 0.15, // Cumulative Layout Shift
      fcp: isLocalhost ? 800 : 1600,  // First Contentful Paint
      ttfb: isLocalhost ? 200 : 500   // Time to First Byte
    };

    // Add some randomness to simulate real measurements
    return {
      lcp: baseMetrics.lcp + Math.random() * 500,
      fid: baseMetrics.fid + Math.random() * 50,
      cls: Math.round((baseMetrics.cls + Math.random() * 0.05) * 100) / 100,
      fcp: baseMetrics.fcp + Math.random() * 300,
      ttfb: baseMetrics.ttfb + Math.random() * 200
    };
  }

  /**
   * Validate structured data for the page
   */
  private async validateStructuredData(url: string): Promise<boolean> {
    try {
      // In a real implementation, this would fetch the page and validate JSON-LD
      // For now, we'll simulate based on the URL pattern

      if (url.includes('/courses/')) {
        // Course pages should have structured data
        logger.debug('Validating structured data for course page', { url });
        return true;
      }

      // Other pages might not have structured data yet
      return false;
    } catch (error) {
      logger.error('Error validating structured data', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Test mobile usability for the page
   */
  private async testMobileUsability(url: string): Promise<boolean> {
    try {
      // In a real implementation, this would use mobile testing tools
      // For now, we'll assume good mobile usability for optimized sites

      const hasResponsiveDesign = url.includes('golf') && !url.includes('legacy');
      logger.debug('Testing mobile usability', { url, hasResponsiveDesign });

      return hasResponsiveDesign;
    } catch (error) {
      logger.error('Error testing mobile usability', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Calculate overall indexability score (0-100)
   */
  private calculateIndexabilityScore(
    performance: { loadTime: number; vitals: CoreWebVitals },
    structuredDataValid: boolean,
    mobileUsable: boolean
  ): number {
    let score = 100;

    // Performance impact (40% of score)
    if (performance.loadTime > 3000) score -= 20;
    if (performance.loadTime > 5000) score -= 10;

    if (performance.vitals.lcp > 2500) score -= 10;
    if (performance.vitals.lcp > 4000) score -= 5;

    if (performance.vitals.fid > 100) score -= 5;
    if (performance.vitals.fid > 300) score -= 5;

    if (performance.vitals.cls > 0.1) score -= 10;
    if (performance.vitals.cls > 0.25) score -= 5;

    // Structured data impact (30% of score)
    if (!structuredDataValid) score -= 30;

    // Mobile usability impact (30% of score)
    if (!mobileUsable) score -= 30;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Validate SEO configuration and setup
   */
  validateSEOSetup(structuredData: StructuredDataSchema): SEOValidationResult {
    const issues: SEOIssue[] = [];
    const recommendations: SEORecommendation[] = [];
    let score = 100;

    try {
      // Validate structured data
      if (!structuredData.golfCourse) {
        issues.push({
          type: 'error',
          field: 'structuredData.golfCourse',
          message: 'Missing golf course structured data',
          impact: 'high'
        });
        score -= 30;
      }

      if (!structuredData.breadcrumb) {
        issues.push({
          type: 'error',
          field: 'structuredData.breadcrumb',
          message: 'Missing breadcrumb structured data',
          impact: 'medium'
        });
        score -= 15;
      }

      // Validate golf course schema
      if (structuredData.golfCourse) {
        if (!structuredData.golfCourse.name) {
          issues.push({
            type: 'error',
            field: 'golfCourse.name',
            message: 'Golf course name is required',
            impact: 'high'
          });
          score -= 10;
        }

        if (!structuredData.golfCourse.address) {
          issues.push({
            type: 'error',
            field: 'golfCourse.address',
            message: 'Golf course address is required',
            impact: 'high'
          });
          score -= 10;
        }

        if (!structuredData.golfCourse.geo) {
          issues.push({
            type: 'warning',
            field: 'golfCourse.geo',
            message: 'Geographic coordinates missing',
            impact: 'medium'
          });
          score -= 5;
        }

        if (!structuredData.golfCourse.image) {
          issues.push({
            type: 'warning',
            field: 'golfCourse.image',
            message: 'Course image missing from structured data',
            impact: 'medium'
          });
          score -= 5;
        }
      }

      // Generate recommendations
      if (score < 90) {
        recommendations.push({
          priority: 'high',
          action: 'Fix missing structured data elements',
          description: 'Add complete golf course and breadcrumb structured data',
          estimatedImpact: 'Improved search engine understanding and rich snippets'
        });
      }

      if (issues.some(issue => issue.field.includes('geo'))) {
        recommendations.push({
          priority: 'medium',
          action: 'Add geographic coordinates',
          description: 'Include latitude and longitude for local search optimization',
          estimatedImpact: 'Better local search visibility'
        });
      }

      return {
        isValid: issues.filter(issue => issue.type === 'error').length === 0,
        score: Math.max(0, score),
        issues,
        recommendations
      };
    } catch (error) {
      logger.error('Error validating SEO setup', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        isValid: false,
        score: 0,
        issues: [{
          type: 'error',
          field: 'validation',
          message: 'Error during SEO validation',
          impact: 'high'
        }],
        recommendations: [{
          priority: 'high',
          action: 'Review SEO configuration',
          description: 'Check SEO setup for errors and missing elements',
          estimatedImpact: 'Restore SEO functionality'
        }]
      };
    }
  }

  /**
   * Monitor Core Web Vitals in real-time (browser environment)
   */
  initializeCoreWebVitalsMonitoring(): void {
    if (typeof window === 'undefined') {
      logger.debug('Core Web Vitals monitoring not available in server environment');
      return;
    }

    // Initialize web-vitals monitoring
    getCLS((metric) => {
      logger.debug('CLS measurement', { value: metric.value });
      this.recordMetric('cls', metric.value);
    });

    getFID((metric) => {
      logger.debug('FID measurement', { value: metric.value });
      this.recordMetric('fid', metric.value);
    });

    getFCP((metric) => {
      logger.debug('FCP measurement', { value: metric.value });
      this.recordMetric('fcp', metric.value);
    });

    getLCP((metric) => {
      logger.debug('LCP measurement', { value: metric.value });
      this.recordMetric('lcp', metric.value);
    });

    getTTFB((metric) => {
      logger.debug('TTFB measurement', { value: metric.value });
      this.recordMetric('ttfb', metric.value);
    });
  }

  /**
   * Record individual metric for analysis
   */
  private recordMetric(metricName: string, value: number): void {
    // In a real implementation, this would send metrics to an analytics service
    logger.debug('Recording Core Web Vital metric', { metricName, value });
  }

  /**
   * Simulate page load for performance testing
   */
  private async simulatePageLoad(url: string): Promise<void> {
    // Simulate network delay based on URL characteristics
    const delay = url.includes('localhost') ? 100 : 500;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Get cached metrics if available and not expired
   */
  private getCachedMetrics(url: string): SEOMetrics | null {
    const cached = this.metricsCache.get(url);

    if (cached) {
      const age = Date.now() - cached.lastAnalyzed.getTime();
      if (age < this.CACHE_TTL) {
        return cached;
      } else {
        this.metricsCache.delete(url);
      }
    }

    return null;
  }

  /**
   * Cache metrics for future use
   */
  private setCachedMetrics(url: string, metrics: SEOMetrics): void {
    this.metricsCache.set(url, metrics);
  }

  /**
   * Generate fallback metrics for error cases
   */
  private generateFallbackMetrics(): SEOMetrics {
    return {
      pageLoadSpeed: 5000,
      coreWebVitals: {
        lcp: 4000,
        fid: 300,
        cls: 0.25,
        fcp: 3000,
        ttfb: 1000
      },
      structuredDataValidation: false,
      mobileUsability: false,
      indexabilityScore: 25,
      lastAnalyzed: new Date()
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(metrics: SEOMetrics): {
    summary: string;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendations: string[];
  } {
    const score = metrics.indexabilityScore;

    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    const recommendations: string[] = [];

    if (metrics.pageLoadSpeed > 3000) {
      recommendations.push('Optimize page load speed - target under 3 seconds');
    }

    if (metrics.coreWebVitals.lcp > 2500) {
      recommendations.push('Improve Largest Contentful Paint - optimize images and critical resources');
    }

    if (metrics.coreWebVitals.cls > 0.1) {
      recommendations.push('Reduce Cumulative Layout Shift - reserve space for dynamic content');
    }

    if (!metrics.structuredDataValidation) {
      recommendations.push('Add structured data markup for better search engine understanding');
    }

    if (!metrics.mobileUsability) {
      recommendations.push('Improve mobile usability and responsive design');
    }

    return {
      summary: `SEO performance score: ${score}/100 (Grade: ${grade})`,
      grade,
      recommendations
    };
  }

  /**
   * Clear metrics cache
   */
  clearCache(): void {
    this.metricsCache.clear();
    logger.debug('SEO metrics cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; urls: string[] } {
    return {
      size: this.metricsCache.size,
      urls: Array.from(this.metricsCache.keys())
    };
  }
}