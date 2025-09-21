export interface ImageMetadata {
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
  quality: 'high' | 'medium' | 'low';
  source: string;
  license?: string;
  lastModified?: Date;
}

export interface ImageVariant {
  width: number;
  height: number;
  format: string;
  quality: number;
  filename: string;
}

export interface OptimizedImage {
  path: string;
  format: string;
  width: number;
  height: number;
  size: number;
}

export interface OptimizationOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  formats: string[];
  progressive: boolean;
}

export interface ImageSet {
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

export interface CourseMedia {
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

export interface ImageQualityReport {
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
  usable: boolean;
}

export interface QualityMetrics {
  overallScore: number;
  sharpness: number;
  exposure: number;
  colorBalance: number;
  resolution: number;
}

export interface ImageContent {
  dominantColors: any;
  composition: string;
  features: string[];
}

export interface GolfContext {
  courseName: string;
  courseType: string;
  location: string;
  features: string[];
}

export interface CourseBasicInfo {
  name: string;
  courseType: string;
  location: string;
  amenities?: string[];
}

export interface DownloadResult {
  success: boolean;
  metadata?: ImageMetadata;
  error?: string;
  localPath?: string;
}

export interface ProcessingResult {
  success: boolean;
  optimizedImages?: OptimizedImage[];
  error?: string;
  qualityReport?: ImageQualityReport;
}
