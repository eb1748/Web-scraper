import React, { useState, useCallback, useEffect } from 'react';
import type { MediaFile } from '../types/quality.types';
import { CourseGalleryImage } from './optimized-image';

interface PhotoGallerySectionProps {
  images: MediaFile[];
  courseName: string;
}

/**
 * Photo Gallery Section Component
 *
 * Displays a responsive photo gallery with:
 * - Grid layout with hover effects
 * - Full-screen lightbox modal
 * - Keyboard navigation support
 * - Lazy loading for performance
 * - Proper accessibility features
 */
export const PhotoGallerySection: React.FC<PhotoGallerySectionProps> = ({
  images,
  courseName
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Don't render if no images
  if (!images || images.length === 0) {
    return null;
  }

  // Open lightbox
  const openLightbox = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setIsLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  // Close lightbox
  const closeLightbox = useCallback(() => {
    setIsLightboxOpen(false);
    setSelectedImageIndex(null);
    document.body.style.overflow = 'unset';
  }, []);

  // Navigate to next image
  const nextImage = useCallback(() => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % images.length);
    }
  }, [selectedImageIndex, images.length]);

  // Navigate to previous image
  const prevImage = useCallback(() => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex(selectedImageIndex === 0 ? images.length - 1 : selectedImageIndex - 1);
    }
  }, [selectedImageIndex, images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!isLightboxOpen) return;

      switch (event.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowRight':
          nextImage();
          break;
        case 'ArrowLeft':
          prevImage();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isLightboxOpen, closeLightbox, nextImage, prevImage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;

  return (
    <>
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">

            {/* Section Header */}
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Photo Gallery
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Explore the beauty and character of {courseName} through our curated collection of course photography
              </p>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {images.map((image, index) => (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-lg bg-gray-100 aspect-video cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
                  onClick={() => openLightbox(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openLightbox(index);
                    }
                  }}
                  aria-label={`View ${image.alt || `${courseName} photo ${index + 1}`} in full size`}
                >
                  <CourseGalleryImage
                    src={image.url}
                    alt={image.alt || `${courseName} photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                    <div className="text-white text-4xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      🔍
                    </div>
                  </div>

                  {/* Image Label */}
                  {image.alt && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-sm font-medium truncate">
                        {image.alt}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* View More Button */}
            {images.length > 9 && (
              <div className="text-center mt-8">
                <button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors">
                  View All {images.length} Photos
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      {isLightboxOpen && selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery lightbox"
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors z-10"
            aria-label="Close lightbox"
          >
            ×
          </button>

          {/* Navigation Buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-4xl hover:text-gray-300 transition-colors z-10"
                aria-label="Previous image"
              >
                ←
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-4xl hover:text-gray-300 transition-colors z-10"
                aria-label="Next image"
              >
                →
              </button>
            </>
          )}

          {/* Image Container */}
          <div
            className="max-w-full max-h-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.url}
              alt={selectedImage.alt || `${courseName} photo ${selectedImageIndex! + 1}`}
              className="max-w-full max-h-[80vh] object-contain"
              loading="eager"
            />

            {/* Image Caption */}
            <div className="mt-4 text-center max-w-2xl">
              {selectedImage.alt && (
                <h3 className="text-white text-lg font-semibold mb-2">
                  {selectedImage.alt}
                </h3>
              )}
              <p className="text-gray-300 text-sm">
                {selectedImageIndex! + 1} of {images.length}
              </p>
            </div>
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 max-w-full overflow-x-auto px-4">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(index);
                  }}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === selectedImageIndex
                      ? 'border-white'
                      : 'border-transparent hover:border-gray-400'
                  }`}
                  aria-label={`View image ${index + 1}`}
                >
                  <img
                    src={image.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};