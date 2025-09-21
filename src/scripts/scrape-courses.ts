import { RequestManager } from '../services/scrapers/request-manager';
import { db } from '../utils/database';
import { scrapingLogger } from '../utils/logger';
import { errorHandler } from '../utils/errors';
import type { ScrapingTarget, ProcessingResult } from '../types/scraping.types';
import type { Course } from '@prisma/client';

interface ScrapingSession {
  id: string;
  startTime: Date;
  totalCourses: number;
  processedCourses: number;
  successfulCourses: number;
  failedCourses: number;
  averageProcessingTime: number;
  errors: string[];
}

class CourseScrapingOrchestrator {
  private requestManager: RequestManager;
  private session: ScrapingSession;

  constructor() {
    this.requestManager = new RequestManager();
    this.session = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      totalCourses: 0,
      processedCourses: 0,
      successfulCourses: 0,
      failedCourses: 0,
      averageProcessingTime: 0,
      errors: [],
    };
  }

  /**
   * Main scraping orchestration method
   */
  async scrapeCourses(courseTargets?: ScrapingTarget[]): Promise<ScrapingSession> {
    try {
      scrapingLogger.info(`Starting course scraping session: ${this.session.id}`);

      // Connect to database
      await db.connect();

      // Get course targets
      const targets = courseTargets || (await this.getScrapingTargets());
      this.session.totalCourses = targets.length;

      scrapingLogger.info(`Found ${targets.length} courses to scrape`);

      // Process courses in batches
      const batchSize = 10;
      const batches = this.createBatches(targets, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        scrapingLogger.info(
          `Processing batch ${i + 1}/${batches.length} (${batch.length} courses)`,
        );

        await this.processBatch(batch);

        // Log progress
        const progress = Math.round(
          (this.session.processedCourses / this.session.totalCourses) * 100,
        );
        scrapingLogger.info(
          `Progress: ${progress}% (${this.session.processedCourses}/${this.session.totalCourses})`,
        );

        // Small delay between batches
        await this.delay(2000);
      }

      // Generate final report
      await this.generateFinalReport();

      scrapingLogger.info(`Scraping session completed: ${this.session.id}`, {
        totalCourses: this.session.totalCourses,
        successful: this.session.successfulCourses,
        failed: this.session.failedCourses,
        duration: Date.now() - this.session.startTime.getTime(),
      });

      return this.session;
    } catch (error) {
      scrapingLogger.error('Critical error in scraping session', error);
      this.session.errors.push(error.message);
      throw error;
    } finally {
      // Cleanup resources
      await this.cleanup();
    }
  }

  /**
   * Get scraping targets from database or predefined list
   */
  private async getScrapingTargets(): Promise<ScrapingTarget[]> {
    try {
      // Get courses from database that need scraping
      const courses = await db.getClient().course.findMany({
        where: {
          OR: [
            { lastUpdated: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Older than 7 days
            { description: null },
            { website: null },
          ],
        },
        take: 100, // Limit to 100 courses per session
        orderBy: [{ lastUpdated: 'asc' }, { name: 'asc' }],
      });

      // Convert to scraping targets
      const targets: ScrapingTarget[] = courses.map((course) => ({
        id: course.id,
        name: course.name,
        url: course.website || this.generateSearchUrl(course.name, course.location),
        priority: this.determinePriority(course),
        sourceType: course.website ? 'official' : 'directory',
        metadata: {
          lastScraped: course.lastUpdated,
          successCount: 0,
          failureCount: 0,
          avgResponseTime: 0,
        },
      }));

      return targets;
    } catch (error) {
      scrapingLogger.error('Error getting scraping targets from database', error);

      // Fallback to sample targets
      return this.getSampleTargets();
    }
  }

  /**
   * Generate search URL for courses without official websites
   */
  private generateSearchUrl(courseName: string, location: string): string {
    const query = encodeURIComponent(`"${courseName}" golf course ${location}`);
    return `https://www.google.com/search?q=${query}`;
  }

  /**
   * Determine scraping priority based on course data
   */
  private determinePriority(course: Course): 'high' | 'medium' | 'low' {
    // High priority for incomplete courses
    if (!course.description || !course.website || !course.phoneNumber) {
      return 'high';
    }

    // Medium priority for courses with major championships
    if (course.majorChampionships.length > 0) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get sample targets for testing
   */
  private getSampleTargets(): ScrapingTarget[] {
    return [
      {
        id: 'pebble-beach',
        name: 'Pebble Beach Golf Links',
        url: 'https://www.pebblebeach.com/golf/pebble-beach-golf-links/',
        priority: 'high',
        sourceType: 'official',
        metadata: {
          successCount: 0,
          failureCount: 0,
          avgResponseTime: 0,
        },
      },
      {
        id: 'augusta-national',
        name: 'Augusta National Golf Club',
        url: 'https://www.masters.com/en_US/course/index.html',
        priority: 'high',
        sourceType: 'official',
        metadata: {
          successCount: 0,
          failureCount: 0,
          avgResponseTime: 0,
        },
      },
      {
        id: 'st-andrews',
        name: 'St Andrews Old Course',
        url: 'https://www.standrews.com/play/courses/old-course',
        priority: 'high',
        sourceType: 'official',
        metadata: {
          successCount: 0,
          failureCount: 0,
          avgResponseTime: 0,
        },
      },
    ];
  }

  /**
   * Create batches from targets
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of courses concurrently
   */
  private async processBatch(targets: ScrapingTarget[]): Promise<void> {
    const promises = targets.map((target) => this.processSingleCourse(target));

    // Process with limited concurrency
    const results = await Promise.allSettled(promises);

    // Update session statistics
    results.forEach((result, index) => {
      this.session.processedCourses++;

      if (result.status === 'fulfilled') {
        this.session.successfulCourses++;
      } else {
        this.session.failedCourses++;
        this.session.errors.push(`${targets[index].name}: ${result.reason.message}`);
      }
    });
  }

  /**
   * Process a single course
   */
  private async processSingleCourse(target: ScrapingTarget): Promise<void> {
    const startTime = Date.now();

    try {
      scrapingLogger.info(`Processing course: ${target.name}`, {
        url: target.url,
        priority: target.priority,
      });

      // Scrape course data
      const result = await this.requestManager.addRequest(target, {
        timeout: 30000,
        javascript: target.sourceType === 'directory', // Use JavaScript for directory sites
        screenshots: false, // Disable screenshots for batch processing
      });

      if (result.success && result.data) {
        // Save to database
        await this.saveCourseData(target.id, result);

        // Log scraping activity
        await this.logScrapingActivity(target, result, true);

        scrapingLogger.info(`Successfully processed: ${target.name}`, {
          confidence: result.confidence,
          processingTime: result.processingTime,
        });
      } else {
        throw new Error(`Scraping failed: ${result.errors.map((e) => e.message).join(', ')}`);
      }
    } catch (error) {
      scrapingLogger.error(`Failed to process course: ${target.name}`, error);

      // Log failed attempt
      await this.logScrapingActivity(target, null, false, error.message);

      throw error;
    } finally {
      // Update average processing time
      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);
    }
  }

  /**
   * Save course data to database
   */
  private async saveCourseData(courseId: string, result: ProcessingResult): Promise<void> {
    try {
      const data = result.data!;

      // Update or create course
      await db.getClient().course.upsert({
        where: { id: courseId },
        update: {
          name: data.name,
          description: data.description,
          architect: data.architect,
          openingYear: data.openingYear,
          courseType: data.courseType,
          totalYardage: data.totalYardage,
          courseRating: data.courseRating,
          slopeRating: data.slopeRating,
          parScore: data.parScore,
          numberOfHoles: data.numberOfHoles,
          website: data.website,
          phoneNumber: data.phoneNumber,
          emailContact: data.emailContact,
          teeTimeBookingUrl: data.teeTimeBookingUrl,
          greensFeePriceRange: data.greensFeePriceRange,
          cartRequired: data.cartRequired,
          dressCode: data.dressCode,
          publicAccess: data.publicAccess,
          heroImageUrl: data.images?.[0],
          galleryImages: data.images || [],
          dataSourceConfidence: data.confidence,
          dataSources: [data.source],
          lastUpdated: new Date(),
        },
        create: {
          id: courseId,
          name: data.name,
          location: data.location || 'Unknown',
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          description: data.description,
          architect: data.architect,
          openingYear: data.openingYear,
          courseType: data.courseType,
          totalYardage: data.totalYardage,
          courseRating: data.courseRating,
          slopeRating: data.slopeRating,
          parScore: data.parScore,
          numberOfHoles: data.numberOfHoles || 18,
          website: data.website,
          phoneNumber: data.phoneNumber,
          emailContact: data.emailContact,
          teeTimeBookingUrl: data.teeTimeBookingUrl,
          greensFeePriceRange: data.greensFeePriceRange,
          cartRequired: data.cartRequired || false,
          dressCode: data.dressCode,
          publicAccess: data.publicAccess ?? true,
          heroImageUrl: data.images?.[0],
          galleryImages: data.images || [],
          majorChampionships: [],
          notableEvents: [],
          pgatourEvents: [],
          keywords: [],
          altTextImages: [],
          dataSourceConfidence: data.confidence,
          dataSources: [data.source],
        },
      });

      scrapingLogger.debug(`Saved course data: ${data.name}`, {
        courseId,
        confidence: data.confidence,
      });
    } catch (error) {
      scrapingLogger.error(`Error saving course data: ${courseId}`, error);
      throw error;
    }
  }

  /**
   * Log scraping activity to database
   */
  private async logScrapingActivity(
    target: ScrapingTarget,
    result: ProcessingResult | null,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await db.getClient().scrapingLog.create({
        data: {
          courseId: target.id,
          level: success ? 'INFO' : 'ERROR',
          category: 'SCRAPING',
          message: success
            ? `Successfully scraped ${target.name}`
            : `Failed to scrape ${target.name}: ${errorMessage}`,
          url: target.url,
          statusCode: result?.metadata?.responseSize ? 200 : undefined,
          duration: result?.processingTime,
          success,
          error: errorMessage,
          metadata: {
            target,
            result: result
              ? {
                  confidence: result.confidence,
                  method: result.metadata.method,
                  finalUrl: result.metadata.finalUrl,
                }
              : undefined,
          },
        },
      });
    } catch (error) {
      scrapingLogger.error('Error logging scraping activity', error);
    }
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(newTime: number): void {
    if (this.session.processedCourses === 1) {
      this.session.averageProcessingTime = newTime;
    } else {
      this.session.averageProcessingTime =
        (this.session.averageProcessingTime * (this.session.processedCourses - 1) + newTime) /
        this.session.processedCourses;
    }
  }

  /**
   * Generate final report
   */
  private async generateFinalReport(): Promise<void> {
    const duration = Date.now() - this.session.startTime.getTime();
    const successRate =
      this.session.totalCourses > 0
        ? (this.session.successfulCourses / this.session.totalCourses) * 100
        : 0;

    const report = {
      sessionId: this.session.id,
      startTime: this.session.startTime,
      endTime: new Date(),
      duration: Math.round(duration / 1000), // seconds
      totalCourses: this.session.totalCourses,
      successfulCourses: this.session.successfulCourses,
      failedCourses: this.session.failedCourses,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: Math.round(this.session.averageProcessingTime),
      errors: this.session.errors,
      requestManagerStats: this.requestManager.getStats(),
    };

    scrapingLogger.info('Scraping session report', report);

    // Save report to file
    const reportPath = `reports/scraping-session-${this.session.id}.json`;
    try {
      const fs = await import('fs-extra');
      await fs.ensureDir('reports');
      await fs.writeJson(reportPath, report, { spaces: 2 });
      scrapingLogger.info(`Session report saved to: ${reportPath}`);
    } catch (error) {
      scrapingLogger.error('Error saving session report', error);
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      await this.requestManager.cleanup();
      await db.disconnect();
      scrapingLogger.info('Scraping session cleanup completed');
    } catch (error) {
      scrapingLogger.error('Error during cleanup', error);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const orchestrator = new CourseScrapingOrchestrator();

  try {
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      scrapingLogger.info('SIGTERM received, shutting down gracefully');
      await orchestrator.cleanup();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      scrapingLogger.info('SIGINT received, shutting down gracefully');
      await orchestrator.cleanup();
      process.exit(0);
    });

    // Start scraping
    const session = await orchestrator.scrapeCourses();

    scrapingLogger.info('Scraping completed successfully', {
      sessionId: session.id,
      successRate: (session.successfulCourses / session.totalCourses) * 100,
    });

    process.exit(0);
  } catch (error) {
    scrapingLogger.error('Scraping failed with critical error', error);
    errorHandler.handle(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { CourseScrapingOrchestrator };
export type { ScrapingSession };
