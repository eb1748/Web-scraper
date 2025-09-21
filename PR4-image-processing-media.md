# PR 4: Image Processing and Media Management

*Automated image collection, processing, and optimization using free tools and libraries*

## 🎯 **Objective**

Implement a comprehensive image processing pipeline to collect, optimize, and manage golf course photography using only free tools and open-source libraries.

## 🖼️ **Image Collection Strategy**

### **Free Image Sources**

**1. Course Official Websites**
- Hero images and gallery photos
- Course layout maps and scorecards
- Facility and amenity photos

**2. Wikipedia Commons**
- Historical course photographs
- Tournament photography
- Architectural documentation

**3. Open Source Photography**
- Pexels (free with attribution)
- Pixabay (free with optional attribution)
- Wikimedia Commons (various licenses)

**4. Government/Public Sources**
- Aerial imagery from USGS
- Public recreation department photos
- Municipal golf course documentation

## 🛠 **Image Processing Pipeline**

### **Core Image Processing Stack (Free Tools)**

```bash
# Image processing dependencies
npm install sharp jimp canvas
npm install image-size file-type
npm install exif-parser gm
```

### **1. Image Downloader and Validator**

```typescript
// src/services/image-downloader.ts
interface ImageMetadata {
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
  quality: 'high' | 'medium' | 'low';
  source: string;
  license?: string;
}

class ImageDownloader {
  async downloadImage(url: string, destination: string): Promise<ImageMetadata> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GolfCourseBot/1.0)',
      },
    });

    // Validate image data
    const buffer = Buffer.from(response.data);
    const metadata = await this.analyzeImage(buffer);

    // Save original image
    await fs.writeFile(destination, buffer);

    return metadata;
  }

  private async analyzeImage(buffer: Buffer): Promise<ImageMetadata> {
    const sharp = require('sharp');
    const { width, height, format } = await sharp(buffer).metadata();

    return {
      url: '',
      width,
      height,
      format,
      size: buffer.length,
      quality: this.assessImageQuality(width, height, buffer.length),
      source: 'downloaded',
    };
  }

  private assessImageQuality(width: number, height: number, size: number): 'high' | 'medium' | 'low' {
    // Assess image quality based on resolution and file size
    if (width >= 1920 && height >= 1080 && size > 500000) return 'high';
    if (width >= 1280 && height >= 720 && size > 200000) return 'medium';
    return 'low';
  }
}
```

### **2. Image Optimization Engine**

```typescript
// src/services/image-optimizer.ts
interface OptimizationOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  formats: string[];
  progressive: boolean;
}

class ImageOptimizer {
  private sharp = require('sharp');

  async optimizeImage(inputPath: string, outputDir: string, options: OptimizationOptions): Promise<OptimizedImage[]> {
    const results: OptimizedImage[] = [];

    // Generate multiple formats and sizes
    const variants = this.generateVariants(options);

    for (const variant of variants) {
      const outputPath = path.join(outputDir, variant.filename);

      const processedBuffer = await this.sharp(inputPath)
        .resize(variant.width, variant.height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: variant.quality, progressive: true })
        .png({ compressionLevel: 8 })
        .webp({ quality: variant.quality })
        .toFormat(variant.format)
        .toBuffer();

      await fs.writeFile(outputPath, processedBuffer);

      results.push({
        path: outputPath,
        format: variant.format,
        width: variant.width,
        height: variant.height,
        size: processedBuffer.length,
      });
    }

    return results;
  }

  private generateVariants(options: OptimizationOptions): ImageVariant[] {
    const variants: ImageVariant[] = [];

    // Generate responsive image sizes
    const sizes = [
      { width: 400, height: 300, suffix: 'sm' },
      { width: 800, height: 600, suffix: 'md' },
      { width: 1200, height: 900, suffix: 'lg' },
      { width: 1920, height: 1440, suffix: 'xl' },
    ];

    for (const size of sizes) {
      for (const format of options.formats) {
        variants.push({
          width: Math.min(size.width, options.maxWidth),
          height: Math.min(size.height, options.maxHeight),
          format,
          quality: options.quality,
          filename: `image-${size.suffix}.${format}`,
        });
      }
    }

    return variants;
  }
}
```

### **3. Alt Text Generator (Free/Open Source)**

```typescript
// src/services/alt-text-generator.ts
class AltTextGenerator {
  async generateAltText(imagePath: string, courseInfo: CourseBasicInfo): Promise<string> {
    // Use image analysis to generate descriptive alt text
    // Combine with course context for golf-specific descriptions
    // Ensure accessibility compliance

    const imageAnalysis = await this.analyzeImageContent(imagePath);
    const golfContext = this.extractGolfContext(courseInfo);

    return this.combineContextualDescription(imageAnalysis, golfContext);
  }

  private async analyzeImageContent(imagePath: string): Promise<ImageContent> {
    // Use open-source image analysis techniques
    // Color analysis, composition detection
    // Basic object detection using free ML models

    const sharp = require('sharp');
    const { dominant } = await sharp(imagePath).stats();

    return {
      dominantColors: dominant,
      composition: this.analyzeComposition(imagePath),
      features: await this.detectBasicFeatures(imagePath),
    };
  }

  private extractGolfContext(courseInfo: CourseBasicInfo): GolfContext {
    return {
      courseName: courseInfo.name,
      courseType: courseInfo.courseType,
      location: courseInfo.location,
      features: courseInfo.amenities || [],
    };
  }

  private combineContextualDescription(analysis: ImageContent, context: GolfContext): string {
    // Generate descriptive alt text combining image analysis with golf context
    // Examples:
    // "Aerial view of Pebble Beach Golf Links showing the 18th hole with Pacific Ocean coastline"
    // "Clubhouse exterior at Augusta National Golf Club with blooming azaleas"

    const baseDescription = this.generateBaseDescription(analysis);
    const contextualElements = this.addGolfContext(context);

    return `${baseDescription} at ${context.courseName}${contextualElements}`;
  }
}
```

## 📁 **Media Management System**

### **File Organization Structure**

```
/media/
  /courses/
    /{courseId}/
      /original/          # Original downloaded images
      /optimized/         # Processed and optimized images
        /hero/           # Main course hero images
          /hero-sm.webp
          /hero-md.webp
          /hero-lg.webp
          /hero-xl.webp
        /gallery/        # Course photo gallery
          /gallery-01-sm.webp
          /gallery-01-md.webp
          ...
        /maps/           # Course layout and scorecard images
          /layout-sm.webp
          /scorecard-lg.webp
      /thumbnails/        # Small preview images
      /metadata.json      # Image metadata and alt text
```

### **Media Database Schema**

```typescript
// src/models/media-model.ts
interface CourseMedia {
  courseId: string;
  images: {
    hero: ImageSet;
    gallery: ImageSet[];
    maps: ImageSet[];
    amenities: ImageSet[];
  };
  metadata: {
    totalImages: number;
    totalSizeMB: number;
    lastUpdated: Date;
    sources: string[];
  };
}

interface ImageSet {
  id: string;
  category: 'hero' | 'gallery' | 'map' | 'amenity';
  originalUrl: string;
  variants: {
    sm: ImageVariant;
    md: ImageVariant;
    lg: ImageVariant;
    xl: ImageVariant;
  };
  altText: string;
  caption?: string;
  license: string;
  source: string;
  uploadDate: Date;
}
```

## 🎨 **Image Enhancement Pipeline**

### **1. Automatic Image Enhancement**

```typescript
// src/services/image-enhancer.ts
class ImageEnhancer {
  async enhanceGolfCourseImage(inputPath: string, outputPath: string): Promise<void> {
    const sharp = require('sharp');

    await sharp(inputPath)
      .gamma(1.1)                    // Slight gamma correction
      .modulate({                    // Color enhancement
        brightness: 1.05,
        saturation: 1.1,
        hue: 0,
      })
      .sharpen(0.5, 1, 2)           // Subtle sharpening
      .toFile(outputPath);
  }

  async createThumbnail(inputPath: string, outputPath: string, size: number = 200): Promise<void> {
    const sharp = require('sharp');

    await sharp(inputPath)
      .resize(size, size, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
  }
}
```

### **2. Batch Processing Scripts**

```typescript
// scripts/process-course-images.ts
async function processCourseImages(courseId: string) {
  const imageCollector = new ImageCollector();
  const optimizer = new ImageOptimizer();
  const enhancer = new ImageEnhancer();

  // 1. Collect images from various sources
  const collectedImages = await imageCollector.collectCourseImages(courseId);

  // 2. Process and optimize each image
  for (const image of collectedImages) {
    // Download original
    const originalPath = await imageCollector.downloadImage(image.url, courseId);

    // Generate optimized variants
    const variants = await optimizer.optimizeImage(originalPath, getOutputDir(courseId), {
      maxWidth: 1920,
      maxHeight: 1440,
      quality: 85,
      formats: ['webp', 'jpg'],
      progressive: true,
    });

    // Generate alt text
    const altText = await altTextGenerator.generateAltText(originalPath, courseInfo);

    // Store metadata
    await this.storeImageMetadata(courseId, image, variants, altText);
  }
}
```

## 🔍 **Image Quality Validation**

### **Quality Assessment System**

```typescript
// src/services/image-validator.ts
interface ImageQualityReport {
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
  usable: boolean;
}

class ImageValidator {
  async validateImage(imagePath: string): Promise<ImageQualityReport> {
    const metadata = await this.getImageMetadata(imagePath);
    const quality = await this.assessImageQuality(imagePath);

    return {
      score: quality.overallScore,
      issues: this.identifyIssues(metadata, quality),
      recommendations: this.generateRecommendations(quality),
      usable: quality.overallScore >= 60,
    };
  }

  private async assessImageQuality(imagePath: string): Promise<QualityMetrics> {
    // Assess resolution, sharpness, exposure, color balance
    // Use open-source image analysis techniques
    // Return comprehensive quality metrics
  }

  private identifyIssues(metadata: any, quality: QualityMetrics): string[] {
    const issues: string[] = [];

    if (metadata.width < 800) issues.push('Low resolution');
    if (quality.sharpness < 0.5) issues.push('Image appears blurry');
    if (quality.exposure < 0.3 || quality.exposure > 0.8) issues.push('Poor exposure');

    return issues;
  }
}
```

## 📋 **Acceptance Criteria**

- [ ] Image downloader with validation implemented
- [ ] Multi-format image optimization pipeline working
- [ ] Responsive image generation (sm, md, lg, xl)
- [ ] Alt text generation system functional
- [ ] Media file organization system created
- [ ] Image quality validation and scoring
- [ ] Batch processing scripts for course images
- [ ] Metadata storage and retrieval system
- [ ] Image enhancement and thumbnail generation
- [ ] Comprehensive error handling and logging

## 🔍 **Testing Requirements**

- Image processing pipeline tests
- Format conversion accuracy tests
- Quality assessment validation tests
- Alt text generation tests
- File organization system tests

## 📚 **Dependencies**

```bash
# Core image processing
npm install sharp jimp
npm install image-size file-type exif-parser
npm install canvas @canvas/image

# Utilities
npm install fs-extra path mime-types
```

## 🚀 **Expected Outcomes**

- Automated image collection from multiple free sources
- Optimized images in multiple formats (WebP, JPEG, PNG)
- Responsive image variants for different screen sizes
- Accessible alt text for all images
- Efficient media management and storage system
- High-quality visual content for 100+ golf courses
- Scalable image processing pipeline for ongoing updates

This PR establishes a complete media management system using only free tools and open-source libraries, ensuring sustainable image processing capabilities.