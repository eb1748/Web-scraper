#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { systemLogger } from '../utils/logger';
import { APIManager } from '../services/api/api-manager';
import { DataValidationManager } from '../utils/data-validation';
import config from '../config/config';
import type {
  WeatherData,
  CourseHistoricalData,
  OSMCourseData,
  CourseEnrichmentData,
  APIResponse
} from '../types/api.types';

const prisma = new PrismaClient();

interface CourseForEnrichment {
  id: string;
  name: string;
  location: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  hasWeatherData: boolean;
  hasHistoricalData: boolean;
  hasLocationData: boolean;
}

interface EnrichmentStats {
  total: number;
  processed: number;
  weatherSuccess: number;
  historySuccess: number;
  locationSuccess: number;
  skipped: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
}

interface EnrichmentOptions {
  batchSize?: number;
  skipExisting?: boolean;
  enableWeather?: boolean;
  enableHistory?: boolean;
  enableLocation?: boolean;
  validateResults?: boolean;
  savePartialResults?: boolean;
  minQualityScore?: number;
  courseFilter?: {
    state?: string;
    city?: string;
    nameContains?: string;
    limit?: number;
  };
}

/**
 * Golf Course API Enrichment Orchestrator
 *
 * This script coordinates the enrichment of golf course data using multiple APIs:
 * - OpenWeather API for current weather and forecasts
 * - Wikipedia API for historical course information
 * - OpenStreetMap API for location and amenity data
 */
export class CourseEnrichmentOrchestrator {
  private apiManager: APIManager;
  private validationManager: DataValidationManager;
  private stats: EnrichmentStats;

  constructor() {
    this.apiManager = new APIManager();
    this.validationManager = new DataValidationManager();
    this.stats = {
      total: 0,
      processed: 0,
      weatherSuccess: 0,
      historySuccess: 0,
      locationSuccess: 0,
      skipped: 0,
      errors: 0,
      startTime: new Date(),
    };
  }

  /**
   * Main enrichment orchestration method
   */
  async enrichCourses(options: EnrichmentOptions = {}): Promise<EnrichmentStats> {
    const opts = this.mergeWithDefaults(options);

    try {
      systemLogger.info('Starting golf course enrichment process', { options: opts });

      // Get courses to enrich
      const courses = await this.getCoursesForEnrichment(opts);
      this.stats.total = courses.length;

      if (courses.length === 0) {
        systemLogger.info('No courses found matching criteria');
        return this.stats;
      }

      systemLogger.info(`Found ${courses.length} courses for enrichment`);

      // Process courses in batches
      const batches = this.createBatches(courses, opts.batchSize!);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        systemLogger.info(`Processing batch ${i + 1}/${batches.length} (${batch.length} courses)`);

        await this.processBatch(batch, opts);

        // Small delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await this.delay(2000);
        }
      }

      this.stats.endTime = new Date();
      await this.logFinalStats();

      return this.stats;

    } catch (error) {
      systemLogger.error('Error during course enrichment', error);
      this.stats.errors++;
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Process a batch of courses
   */
  private async processBatch(courses: CourseForEnrichment[], options: EnrichmentOptions): Promise<void> {
    const promises = courses.map(course => this.enrichSingleCourse(course, options));
    await Promise.allSettled(promises);
  }

  /**
   * Enrich a single golf course with all available APIs
   */
  private async enrichSingleCourse(course: CourseForEnrichment, options: EnrichmentOptions): Promise<void> {
    try {
      systemLogger.debug(`Enriching course: ${course.name} (${course.city}, ${course.state})`);

      const enrichmentData: Partial<CourseEnrichmentData> = {
        courseId: course.id,
        courseName: course.name,
        location: {
          latitude: course.latitude,
          longitude: course.longitude,
          city: course.city,
          state: course.state,
        },
        enrichmentDate: new Date(),
        dataQuality: { overallScore: 0, issues: [], confidence: 0 },
      };

      // Parallel API calls for maximum efficiency
      const apiCalls: Promise<any>[] = [];

      if (options.enableWeather && (!course.hasWeatherData || !options.skipExisting)) {
        apiCalls.push(this.enrichWeatherData(course, enrichmentData));
      }

      if (options.enableHistory && (!course.hasHistoricalData || !options.skipExisting)) {
        apiCalls.push(this.enrichHistoricalData(course, enrichmentData));
      }

      if (options.enableLocation && (!course.hasLocationData || !options.skipExisting)) {
        apiCalls.push(this.enrichLocationData(course, enrichmentData));
      }

      // Wait for all API calls to complete
      const results = await Promise.allSettled(apiCalls);

      // Process results
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          systemLogger.warn(`API call ${index} failed for course ${course.name}`, result.reason);
        }
      });

      // Validate enriched data
      if (options.validateResults) {
        await this.validateEnrichmentData(enrichmentData as CourseEnrichmentData, options);
      }

      // Save enriched data
      if (options.savePartialResults || this.isEnrichmentComplete(enrichmentData)) {
        await this.saveEnrichmentData(course.id, enrichmentData);
      }

      this.stats.processed++;

    } catch (error) {
      systemLogger.error(`Error enriching course ${course.name}`, error);
      this.stats.errors++;
    }
  }

  /**
   * Enrich course with weather data
   */
  private async enrichWeatherData(course: CourseForEnrichment, enrichmentData: Partial<CourseEnrichmentData>): Promise<void> {
    try {
      const weatherResult = await this.apiManager.getGolfWeather(course.id, course.latitude, course.longitude);

      if (weatherResult.success && weatherResult.data) {
        enrichmentData.weather = weatherResult.data;
        this.stats.weatherSuccess++;

        systemLogger.debug(`Weather data enriched for ${course.name}`, {
          temperature: weatherResult.data.current.temperature,
          conditions: weatherResult.data.current.description,
          golfConditions: weatherResult.data.golfConditions?.playability,
        });
      }
    } catch (error) {
      systemLogger.warn(`Failed to enrich weather data for ${course.name}`, error);
    }
  }

  /**
   * Enrich course with historical data
   */
  private async enrichHistoricalData(course: CourseForEnrichment, enrichmentData: Partial<CourseEnrichmentData>): Promise<void> {
    try {
      const historyResult = await this.apiManager.getCourseHistory(course.name, course.location);

      if (historyResult.success && historyResult.data) {
        enrichmentData.history = historyResult.data;
        this.stats.historySuccess++;

        systemLogger.debug(`Historical data enriched for ${course.name}`, {
          architect: historyResult.data.architect,
          openingYear: historyResult.data.openingYear,
          championships: historyResult.data.notableChampionships?.length || 0,
        });
      }
    } catch (error) {
      systemLogger.warn(`Failed to enrich historical data for ${course.name}`, error);
    }
  }

  /**
   * Enrich course with location data
   */
  private async enrichLocationData(course: CourseForEnrichment, enrichmentData: Partial<CourseEnrichmentData>): Promise<void> {
    try {
      const locationResult = await this.apiManager.getCourseLocation(course.name, course.city, course.state);

      if (locationResult.success && locationResult.data) {
        enrichmentData.location = {
          ...enrichmentData.location!,
          ...locationResult.data,
        };
        this.stats.locationSuccess++;

        systemLogger.debug(`Location data enriched for ${course.name}`, {
          amenities: locationResult.data.amenities?.length || 0,
          features: locationResult.data.features?.length || 0,
        });
      }
    } catch (error) {
      systemLogger.warn(`Failed to enrich location data for ${course.name}`, error);
    }
  }

  /**
   * Validate enrichment data quality
   */
  private async validateEnrichmentData(data: CourseEnrichmentData, options: EnrichmentOptions): Promise<void> {
    try {
      const validation = await this.validationManager.validateData('course_enrichment', data);

      if (validation.valid) {
        data.dataQuality = {
          overallScore: 100,
          issues: [],
          confidence: 95,
        };
      } else {
        data.dataQuality = {
          overallScore: Math.max(0, 100 - (validation.errors.length * 20)),
          issues: validation.errors,
          confidence: Math.max(0, 90 - (validation.errors.length * 15)),
        };

        if (data.dataQuality.overallScore < options.minQualityScore!) {
          systemLogger.warn(`Data quality below threshold for ${data.courseName}`, {
            score: data.dataQuality.overallScore,
            threshold: options.minQualityScore,
            issues: validation.errors,
          });
        }
      }
    } catch (error) {
      systemLogger.warn(`Failed to validate enrichment data for ${data.courseName}`, error);
    }
  }

  /**
   * Save enrichment data to database
   */
  private async saveEnrichmentData(courseId: string, data: Partial<CourseEnrichmentData>): Promise<void> {
    try {
      // In a real implementation, this would save to your database
      // For now, we'll log the enrichment
      systemLogger.info(`Saving enrichment data for course ${courseId}`, {
        hasWeather: !!data.weather,
        hasHistory: !!data.history,
        hasLocation: !!data.location,
        qualityScore: data.dataQuality?.overallScore,
      });

      // TODO: Implement actual database saving logic based on your schema
      // Example:
      // await prisma.courseEnrichment.create({
      //   data: {
      //     courseId,
      //     weatherData: data.weather ? JSON.stringify(data.weather) : null,
      //     historicalData: data.history ? JSON.stringify(data.history) : null,
      //     locationData: data.location ? JSON.stringify(data.location) : null,
      //     qualityScore: data.dataQuality?.overallScore,
      //     enrichmentDate: new Date(),
      //   }
      // });

    } catch (error) {
      systemLogger.error(`Failed to save enrichment data for course ${courseId}`, error);
    }
  }

  /**
   * Get courses that need enrichment
   */
  private async getCoursesForEnrichment(options: EnrichmentOptions): Promise<CourseForEnrichment[]> {
    try {
      // TODO: Implement actual database query based on your schema
      // This is a placeholder that shows the expected structure

      systemLogger.info('Fetching courses for enrichment', { filter: options.courseFilter });

      // Example query structure (adapt to your actual Prisma schema):
      /*
      const courses = await prisma.course.findMany({
        where: {
          ...(options.courseFilter?.state && { state: options.courseFilter.state }),
          ...(options.courseFilter?.city && { city: options.courseFilter.city }),
          ...(options.courseFilter?.nameContains && {
            name: { contains: options.courseFilter.nameContains, mode: 'insensitive' }
          }),
        },
        take: options.courseFilter?.limit,
        select: {
          id: true,
          name: true,
          location: true,
          city: true,
          state: true,
          latitude: true,
          longitude: true,
          // Add fields to check existing enrichment data
          weatherData: { select: { id: true } },
          historicalData: { select: { id: true } },
          locationData: { select: { id: true } },
        },
      });

      return courses.map(course => ({
        id: course.id,
        name: course.name,
        location: course.location,
        city: course.city,
        state: course.state,
        latitude: course.latitude,
        longitude: course.longitude,
        hasWeatherData: !!course.weatherData,
        hasHistoricalData: !!course.historicalData,
        hasLocationData: !!course.locationData,
      }));
      */

      // For demonstration, return mock data
      return [
        {
          id: 'course-1',
          name: 'Pebble Beach Golf Links',
          location: 'Pebble Beach, CA',
          city: 'Pebble Beach',
          state: 'CA',
          latitude: 36.5674,
          longitude: -121.9487,
          hasWeatherData: false,
          hasHistoricalData: false,
          hasLocationData: false,
        },
        {
          id: 'course-2',
          name: 'Augusta National Golf Club',
          location: 'Augusta, GA',
          city: 'Augusta',
          state: 'GA',
          latitude: 33.5030,
          longitude: -82.0197,
          hasWeatherData: false,
          hasHistoricalData: false,
          hasLocationData: false,
        },
      ];

    } catch (error) {
      systemLogger.error('Error fetching courses for enrichment', error);
      return [];
    }
  }

  /**
   * Merge provided options with defaults
   */
  private mergeWithDefaults(options: EnrichmentOptions): Required<EnrichmentOptions> {
    return {
      batchSize: options.batchSize ?? config.api.enrichment.batchSize,
      skipExisting: options.skipExisting ?? config.api.enrichment.skipExistingData,
      enableWeather: options.enableWeather ?? config.api.weather.enabled,
      enableHistory: options.enableHistory ?? config.api.wikipedia.enabled,
      enableLocation: options.enableLocation ?? config.api.osm.enabled,
      validateResults: options.validateResults ?? config.api.enrichment.validateResults,
      savePartialResults: options.savePartialResults ?? config.api.enrichment.savePartialResults,
      minQualityScore: options.minQualityScore ?? config.api.enrichment.minDataQualityScore,
      courseFilter: options.courseFilter ?? {},
    };
  }

  /**
   * Create batches from courses array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Check if enrichment data is complete
   */
  private isEnrichmentComplete(data: Partial<CourseEnrichmentData>): boolean {
    return !!(data.weather && data.history && data.location);
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log final enrichment statistics
   */
  private async logFinalStats(): Promise<void> {
    const duration = this.stats.endTime
      ? this.stats.endTime.getTime() - this.stats.startTime.getTime()
      : Date.now() - this.stats.startTime.getTime();

    const durationMinutes = Math.round(duration / 60000 * 100) / 100;

    systemLogger.info('Course enrichment completed', {
      stats: {
        total: this.stats.total,
        processed: this.stats.processed,
        weatherSuccess: this.stats.weatherSuccess,
        historySuccess: this.stats.historySuccess,
        locationSuccess: this.stats.locationSuccess,
        skipped: this.stats.skipped,
        errors: this.stats.errors,
        successRate: Math.round((this.stats.processed / this.stats.total) * 100) + '%',
        durationMinutes,
      },
    });

    // Log API Manager stats
    const apiStats = this.apiManager.getStats();
    systemLogger.info('API usage statistics', apiStats);
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      await this.apiManager.cleanup();
      await prisma.$disconnect();
    } catch (error) {
      systemLogger.warn('Error during cleanup', error);
    }
  }
}

/**
 * CLI interface for running the enrichment script
 */
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);

    // Parse CLI arguments
    const options: EnrichmentOptions = {};

    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i];
      const value = args[i + 1];

      switch (flag) {
        case '--batch-size':
          options.batchSize = parseInt(value, 10);
          break;
        case '--state':
          options.courseFilter = { ...options.courseFilter, state: value };
          break;
        case '--city':
          options.courseFilter = { ...options.courseFilter, city: value };
          break;
        case '--name':
          options.courseFilter = { ...options.courseFilter, nameContains: value };
          break;
        case '--limit':
          options.courseFilter = { ...options.courseFilter, limit: parseInt(value, 10) };
          break;
        case '--skip-existing':
          options.skipExisting = value === 'true';
          break;
        case '--weather':
          options.enableWeather = value === 'true';
          break;
        case '--history':
          options.enableHistory = value === 'true';
          break;
        case '--location':
          options.enableLocation = value === 'true';
          break;
        case '--min-quality':
          options.minQualityScore = parseInt(value, 10);
          break;
        case '--help':
          printUsage();
          process.exit(0);
          break;
      }
    }

    systemLogger.info('Starting course enrichment with options', options);

    const orchestrator = new CourseEnrichmentOrchestrator();
    const stats = await orchestrator.enrichCourses(options);

    console.log('\n✅ Enrichment completed successfully!');
    console.log(`📊 Processed ${stats.processed}/${stats.total} courses`);
    console.log(`🌤️  Weather: ${stats.weatherSuccess} success`);
    console.log(`📚 History: ${stats.historySuccess} success`);
    console.log(`📍 Location: ${stats.locationSuccess} success`);

    if (stats.errors > 0) {
      console.log(`⚠️  Errors: ${stats.errors}`);
    }

  } catch (error) {
    systemLogger.error('Course enrichment failed', error);
    console.error('❌ Enrichment failed:', error);
    process.exit(1);
  }
}

function printUsage(): void {
  console.log(`
Golf Course API Enrichment Tool

Usage: tsx src/scripts/enrich-courses.ts [options]

Options:
  --batch-size <number>     Number of courses to process per batch (default: 10)
  --state <string>          Filter courses by state
  --city <string>           Filter courses by city
  --name <string>           Filter courses by name (contains)
  --limit <number>          Maximum number of courses to process
  --skip-existing <boolean> Skip courses with existing enrichment data (default: true)
  --weather <boolean>       Enable weather data enrichment (default: true)
  --history <boolean>       Enable historical data enrichment (default: true)
  --location <boolean>      Enable location data enrichment (default: true)
  --min-quality <number>    Minimum data quality score (default: 70)
  --help                    Show this help message

Examples:
  # Enrich all courses in California
  tsx src/scripts/enrich-courses.ts --state CA

  # Enrich first 5 courses with weather data only
  tsx src/scripts/enrich-courses.ts --limit 5 --history false --location false

  # Enrich courses in Augusta, GA with small batch size
  tsx src/scripts/enrich-courses.ts --city Augusta --state GA --batch-size 2
`);
}

// Run the script if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { CourseEnrichmentOrchestrator, type EnrichmentOptions, type EnrichmentStats };