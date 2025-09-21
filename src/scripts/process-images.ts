import * as fs from 'fs-extra';
import * as path from 'path';
import { ImageDownloader } from '../services/media/image-downloader';
import { ImageOptimizer } from '../services/media/image-optimizer';
import { ImageEnhancer } from '../services/media/image-enhancer';
import { AltTextGenerator } from '../services/media/alt-text-generator';
import { MediaManager } from '../services/media/media-manager';
import { ImageValidator } from '../services/media/image-validator';
import type { CourseBasicInfo } from '../types/media.types';
import logger from '../utils/logger';

interface ProcessingOptions {
  courseId: string;
  courseName: string;
  imageUrls: string[];
  location?: string;
  courseType?: string;
  skipValidation?: boolean;
  enhanceImages?: boolean;
  generateThumbnails?: boolean;
  categories?: string[];
}

interface ProcessingResult {
  success: boolean;
  courseId: string;
  processedImages: number;
  failedImages: number;
  totalSizeMB: number;
  issues: string[];
  summary: string;
}

export class ImageProcessor {
  private downloader: ImageDownloader;
  private optimizer: ImageOptimizer;
  private enhancer: ImageEnhancer;
  private altTextGenerator: AltTextGenerator;
  private mediaManager: MediaManager;
  private validator: ImageValidator;

  constructor() {
    this.downloader = new ImageDownloader();
    this.optimizer = new ImageOptimizer();
    this.enhancer = new ImageEnhancer();
    this.altTextGenerator = new AltTextGenerator();
    this.mediaManager = new MediaManager();
    this.validator = new ImageValidator();
  }

  async processCourseImages(options: ProcessingOptions): Promise<ProcessingResult> {
    const startTime = Date.now();
    let processedCount = 0;
    let failedCount = 0;
    const issues: string[] = [];

    try {
      logger.info(
        `Starting image processing for course ${options.courseId} (${options.courseName})`,
      );

      // Initialize directory structure
      await this.mediaManager.initializeCourseDirectories(options.courseId);

      // Prepare course info for alt text generation
      const courseInfo: CourseBasicInfo = {
        name: options.courseName,
        location: options.location || '',
        courseType: options.courseType || 'golf course',
      };

      // Process each image
      for (let i = 0; i < options.imageUrls.length; i++) {
        const imageUrl = options.imageUrls[i];
        const category = options.categories?.[i] || (i === 0 ? 'hero' : 'gallery');

        logger.info(`Processing image ${i + 1}/${options.imageUrls.length}: ${imageUrl}`);

        try {
          const result = await this.processImage({
            url: imageUrl,
            courseId: options.courseId,
            courseInfo,
            category,
            skipValidation: options.skipValidation,
            enhanceImages: options.enhanceImages,
            generateThumbnails: options.generateThumbnails,
          });

          if (result.success) {
            processedCount++;
          } else {
            failedCount++;
            if (result.error) {
              issues.push(`Image ${i + 1}: ${result.error}`);
            }
          }
        } catch (error) {
          failedCount++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          issues.push(`Image ${i + 1}: ${errorMsg}`);
          logger.error(`Failed to process image ${imageUrl}:`, error);
        }

        // Add delay between images to be respectful
        if (i < options.imageUrls.length - 1) {
          await this.delay(1000);
        }
      }

      // Get final storage info
      const storageInfo = await this.mediaManager.getStorageInfo(options.courseId);

      const processingTime = (Date.now() - startTime) / 1000;
      const summary = `Processed ${processedCount}/${options.imageUrls.length} images in ${processingTime}s. Total size: ${storageInfo.totalSizeMB}MB`;

      logger.info(`Completed image processing for course ${options.courseId}: ${summary}`);

      return {
        success: processedCount > 0,
        courseId: options.courseId,
        processedImages: processedCount,
        failedImages: failedCount,
        totalSizeMB: storageInfo.totalSizeMB,
        issues,
        summary,
      };
    } catch (error) {
      logger.error(`Image processing failed for course ${options.courseId}:`, error);
      return {
        success: false,
        courseId: options.courseId,
        processedImages: processedCount,
        failedImages: failedCount,
        totalSizeMB: 0,
        issues: [
          ...issues,
          `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        summary: 'Processing failed',
      };
    }
  }

  private async processImage(params: {
    url: string;
    courseId: string;
    courseInfo: CourseBasicInfo;
    category: string;
    skipValidation?: boolean;
    enhanceImages?: boolean;
    generateThumbnails?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    const {
      url,
      courseId,
      courseInfo,
      category,
      skipValidation,
      enhanceImages,
      generateThumbnails,
    } = params;

    try {
      // Step 1: Download image
      logger.debug(`Downloading image: ${url}`);
      const downloadResult = await this.downloader.downloadImage(url, courseId, category);

      if (!downloadResult.success || !downloadResult.localPath) {
        return { success: false, error: downloadResult.error || 'Download failed' };
      }

      // Step 2: Validate image quality (unless skipped)
      if (!skipValidation) {
        logger.debug(`Validating image quality: ${downloadResult.localPath}`);
        const validationReport = await this.validator.validateForGolfCourse(
          downloadResult.localPath,
          category,
        );

        if (!validationReport.usable) {
          logger.warn(`Image failed validation: ${validationReport.issues.join(', ')}`);
          // Continue processing but log the issues
        }
      }

      // Step 3: Enhance image (if requested)
      let processedImagePath = downloadResult.localPath;
      if (enhanceImages) {
        logger.debug(`Enhancing image: ${downloadResult.localPath}`);
        const enhancedPath = downloadResult.localPath.replace(
          /\.(jpg|jpeg|png)$/i,
          '-enhanced.jpg',
        );
        const enhanceResult = await this.enhancer.enhanceGolfCourseImage(
          downloadResult.localPath,
          enhancedPath,
          { golfOptimized: true },
        );

        if (enhanceResult.success && enhanceResult.outputPath) {
          processedImagePath = enhanceResult.outputPath;
        }
      }

      // Step 4: Optimize image (create responsive variants)
      logger.debug(`Optimizing image: ${processedImagePath}`);
      const optimizeResult = await this.optimizer.optimizeImage(
        processedImagePath,
        courseId,
        category,
        {
          maxWidth: 1920,
          maxHeight: 1440,
          quality: 85,
          formats: ['webp', 'jpeg'],
          progressive: true,
        },
      );

      if (!optimizeResult.success || !optimizeResult.optimizedImages) {
        return { success: false, error: optimizeResult.error || 'Optimization failed' };
      }

      // Step 5: Generate thumbnails (if requested)
      if (generateThumbnails) {
        logger.debug(`Creating thumbnail: ${processedImagePath}`);
        const thumbnailPath = this.mediaManager.getImagePaths(
          courseId,
          category,
          `thumb-${Date.now()}`,
        ).thumbnail;
        await this.enhancer.createThumbnail(processedImagePath, thumbnailPath, 200, 80);
      }

      // Step 6: Generate alt text
      logger.debug(`Generating alt text: ${processedImagePath}`);
      const altText = await this.altTextGenerator.generateAltText(
        processedImagePath,
        courseInfo,
        category,
      );

      // Step 7: Store metadata
      const imageId = `${category}-${Date.now()}`;
      await this.mediaManager.storeImageMetadata(
        courseId,
        imageId,
        downloadResult.metadata!,
        optimizeResult.optimizedImages,
        altText,
        category as any,
      );

      logger.debug(`Successfully processed image: ${url}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to process image ${url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error',
      };
    }
  }

  async batchProcessFromCourseList(coursesFile: string): Promise<ProcessingResult[]> {
    try {
      logger.info(`Starting batch processing from file: ${coursesFile}`);

      const coursesData = await fs.readJSON(coursesFile);
      const results: ProcessingResult[] = [];

      for (let i = 0; i < coursesData.length; i++) {
        const course = coursesData[i];
        logger.info(`Processing course ${i + 1}/${coursesData.length}: ${course.name}`);

        if (!course.images || course.images.length === 0) {
          logger.warn(`No images found for course: ${course.name}`);
          continue;
        }

        const result = await this.processCourseImages({
          courseId: course.id || `course-${i}`,
          courseName: course.name,
          imageUrls: course.images,
          location: course.location,
          courseType: course.type,
          enhanceImages: true,
          generateThumbnails: true,
          categories: course.imageCategories,
        });

        results.push(result);

        // Delay between courses
        if (i < coursesData.length - 1) {
          await this.delay(2000);
        }
      }

      logger.info(`Completed batch processing: ${results.length} courses processed`);
      return results;
    } catch (error) {
      logger.error(`Batch processing failed:`, error);
      throw error;
    }
  }

  async generateProcessingReport(results: ProcessingResult[]): Promise<void> {
    const reportPath = path.join(process.cwd(), 'reports', `image-processing-${Date.now()}.json`);
    await fs.ensureDir(path.dirname(reportPath));

    const summary = {
      totalCourses: results.length,
      successfulCourses: results.filter((r) => r.success).length,
      totalImagesProcessed: results.reduce((sum, r) => sum + r.processedImages, 0),
      totalImagesFailed: results.reduce((sum, r) => sum + r.failedImages, 0),
      totalSizeMB: results.reduce((sum, r) => sum + r.totalSizeMB, 0),
      allIssues: results.flatMap((r) => r.issues),
      generatedAt: new Date().toISOString(),
    };

    const report = {
      summary,
      details: results,
    };

    await fs.writeJSON(reportPath, report, { spaces: 2 });
    logger.info(`Processing report saved: ${reportPath}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// CLI script functionality
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: npm run process:images -- [options]

Options:
  --course-id <id>        Process specific course by ID
  --course-name <name>    Course name for processing
  --images <url1,url2>    Comma-separated image URLs
  --batch-file <path>     Process multiple courses from JSON file
  --location <location>   Course location
  --type <type>          Course type
  --enhance              Enable image enhancement
  --thumbnails           Generate thumbnails
  --skip-validation      Skip quality validation

Examples:
  npm run process:images -- --course-id "pebble-beach" --course-name "Pebble Beach" --images "https://example.com/img1.jpg,https://example.com/img2.jpg" --enhance --thumbnails
  npm run process:images -- --batch-file "./data/courses.json"
    `);
    return;
  }

  const processor = new ImageProcessor();

  try {
    // Parse command line arguments
    const options = parseArgs(args);

    if (options.batchFile) {
      // Batch processing
      const results = await processor.batchProcessFromCourseList(options.batchFile);
      await processor.generateProcessingReport(results);
      console.log(`Batch processing completed. ${results.length} courses processed.`);
    } else if (options.courseId && options.courseName && options.images) {
      // Single course processing
      const result = await processor.processCourseImages({
        courseId: options.courseId,
        courseName: options.courseName,
        imageUrls: options.images.split(','),
        location: options.location,
        courseType: options.type,
        enhanceImages: options.enhance,
        generateThumbnails: options.thumbnails,
        skipValidation: options.skipValidation,
      });

      console.log(`Processing completed: ${result.summary}`);
      if (result.issues.length > 0) {
        console.log('Issues:', result.issues);
      }
    } else {
      console.error('Missing required arguments. Use --help for usage information.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Processing failed:', error);
    process.exit(1);
  }
}

function parseArgs(args: string[]): any {
  const options: any = {};

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--course-id':
        options.courseId = value;
        break;
      case '--course-name':
        options.courseName = value;
        break;
      case '--images':
        options.images = value;
        break;
      case '--batch-file':
        options.batchFile = value;
        break;
      case '--location':
        options.location = value;
        break;
      case '--type':
        options.type = value;
        break;
      case '--enhance':
        options.enhance = true;
        i--; // No value for this flag
        break;
      case '--thumbnails':
        options.thumbnails = true;
        i--; // No value for this flag
        break;
      case '--skip-validation':
        options.skipValidation = true;
        i--; // No value for this flag
        break;
    }
  }

  return options;
}

// Run the script if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { ImageProcessor };
