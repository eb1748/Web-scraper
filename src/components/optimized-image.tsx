import React, { useState, useCallback } from 'react';
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  fill?: boolean;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
}

/**
 * Optimized Image Component
 *
 * Provides performance-optimized image rendering with:
 * - WebP format with JPEG/PNG fallbacks
 * - Lazy loading with intersection observer
 * - Responsive image variants
 * - Error handling with fallback images
 * - Progressive loading with blur placeholder
 * - Core Web Vitals optimization
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  fill = false,
  sizes,
  quality = 85,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
  style
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Handle image load success
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  // Handle image load error with fallback
  const handleError = useCallback(() => {
    setImageError(true);
    setIsLoading(false);
    onError?.();
  }, [onError]);

  // Generate fallback image URL
  const getFallbackSrc = (): string => {
    // Return a default golf course placeholder image
    return '/images/golf-course-placeholder.jpg';
  };

  // Generate responsive sizes if not provided
  const getResponsiveSizes = (): string => {
    if (sizes) return sizes;

    // Default responsive sizes for golf course images
    if (fill) {
      return '100vw';
    }

    // Provide reasonable defaults based on image dimensions
    if (width > 1200) {
      return '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px';
    } else if (width > 800) {
      return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px';
    } else {
      return '(max-width: 768px) 100vw, 400px';
    }
  };

  // Generate blur placeholder if not provided
  const getBlurDataURL = (): string => {
    if (blurDataURL) return blurDataURL;

    // Generate a simple gray blur placeholder
    return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  };

  if (imageError) {
    return (
      <Image
        src={getFallbackSrc()}
        alt={`Fallback image for ${alt}`}
        width={width}
        height={height}
        className={`${className} opacity-75`}
        priority={priority}
        fill={fill}
        sizes={getResponsiveSizes()}
        quality={quality}
        style={style}
      />
    );
  }

  return (
    <div className={`relative ${isLoading ? 'animate-pulse bg-gray-200' : ''}`}>
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        className={className}
        sizes={getResponsiveSizes()}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={placeholder === 'blur' ? getBlurDataURL() : undefined}
        onLoad={handleLoad}
        onError={handleError}
        style={style}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      )}
    </div>
  );
};

/**
 * Golf Course Hero Image Component
 * Specialized component for course hero images with optimized settings
 */
export const CourseHeroImage: React.FC<{
  src: string;
  alt: string;
  courseName: string;
  className?: string;
}> = ({ src, alt, courseName, className = '' }) => {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={1920}
      height={1080}
      priority={true}
      className={`w-full h-96 md:h-[500px] object-cover ${className}`}
      sizes="100vw"
      quality={90}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
    />
  );
};

/**
 * Golf Course Gallery Image Component
 * Optimized for gallery display with lazy loading
 */
export const CourseGalleryImage: React.FC<{
  src: string;
  alt: string;
  onClick?: () => void;
  className?: string;
}> = ({ src, alt, onClick, className = '' }) => {
  return (
    <div className={`cursor-pointer overflow-hidden rounded-lg ${className}`} onClick={onClick}>
      <OptimizedImage
        src={src}
        alt={alt}
        width={400}
        height={300}
        className="w-full h-48 object-cover transition-transform duration-300 hover:scale-105"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
        quality={80}
        placeholder="blur"
      />
    </div>
  );
};

/**
 * Course Thumbnail Image Component
 * For small preview images in listings
 */
export const CourseThumbnailImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = '' }) => {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={200}
      height={150}
      className={`w-full h-32 object-cover rounded ${className}`}
      sizes="(max-width: 768px) 50vw, 200px"
      quality={75}
      placeholder="blur"
    />
  );
};

/**
 * Responsive Course Map Image Component
 */
export const CourseMapImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = '' }) => {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={800}
      height={600}
      className={`w-full h-auto object-contain ${className}`}
      sizes="(max-width: 768px) 100vw, 800px"
      quality={90}
      placeholder="blur"
    />
  );
};

export default OptimizedImage;