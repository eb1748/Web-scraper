import { generateSEOMetadata } from '../../services/seo/seo-metadata-generator';
import { ContentOptimizer } from '../../services/seo/content-optimizer';
import { generateStructuredData } from '../../services/seo/structured-data-generator';
import type { AutomatedCourseDetails } from '../../types/quality.types';

// Mock course data for testing
const mockCourseData: AutomatedCourseDetails = {
  id: 'test-pebble-beach',
  name: 'Pebble Beach Golf Links',
  location: 'Pebble Beach, CA 93953',
  state: 'CA',
  description: 'Pebble Beach Golf Links is a legendary oceanfront golf course located in Pebble Beach, California. Known for its stunning Pacific Ocean views and challenging holes.',
  phoneNumber: '(831) 622-8723',
  website: 'https://www.pebblebeach.com',
  greensFeePriceRange: '$595-$695',
  publicAccess: true,
  cartRequired: false,
  courseType: 'Public',
  numberOfHoles: 18,
  totalYardage: 6828,
  courseRating: 74.8,
  slopeRating: 145,
  establishedYear: 1919,
  architect: 'Jack Neville, Douglas Grant',
  designedBy: 'Jack Neville and Douglas Grant',
  par: 72,
  difficulty: 'Championship',
  drivingRange: true,
  puttingGreen: true,
  chippingGreen: true,
  proShop: true,
  restaurant: true,
  clubhouse: true,
  rentals: true,
  lessons: true,
  membershipAvailable: false,
  teeTimeBookingUrl: 'https://www.pebblebeach.com/golf/tee-times/',
  qualityScore: 95,
  completenessScore: 98,
  lastUpdated: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockWeatherData = {
  current: {
    temperature: 72,
    description: 'Partly cloudy',
    windSpeed: 8,
    humidity: 65
  },
  forecast: [
    {
      date: '2025-01-15',
      high: 75,
      low: 60,
      description: 'Sunny',
      playabilityScore: 95
    }
  ]
};

const mockNearbyAmenities = [
  {
    name: 'The Lodge at Pebble Beach',
    type: 'Hotel',
    distance: 0.2,
    rating: 4.8
  }
];

describe('SEO Metadata Generation', () => {
  let contentOptimizer: ContentOptimizer;

  beforeEach(() => {
    contentOptimizer = new ContentOptimizer();
  });

  describe('generateSEOMetadata', () => {
    it('should generate complete SEO metadata for a golf course', async () => {
      const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

      const seoMetadata = await generateSEOMetadata(
        mockCourseData,
        optimizedContent,
        mockWeatherData,
        mockNearbyAmenities
      );

      // Test basic metadata
      expect(seoMetadata.title).toBeDefined();
      expect(seoMetadata.title).toContain('Pebble Beach Golf Links');
      expect(seoMetadata.title.length).toBeLessThanOrEqual(60);

      expect(seoMetadata.description).toBeDefined();
      expect(seoMetadata.description.length).toBeLessThanOrEqual(160);
      expect(seoMetadata.description).toContain('Pebble Beach');

      expect(seoMetadata.keywords).toBeDefined();
      expect(Array.isArray(seoMetadata.keywords)).toBe(true);
      expect(seoMetadata.keywords.length).toBeGreaterThan(0);

      // Test canonical URL
      expect(seoMetadata.canonical).toBeDefined();
      expect(seoMetadata.canonical).toMatch(/^https?:\/\//);

      // Test structured data
      expect(seoMetadata.structuredData).toBeDefined();
      expect(typeof seoMetadata.structuredData).toBe('object');
    });

    it('should generate proper title tag with location and course name', async () => {
      const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

      const seoMetadata = await generateSEOMetadata(
        mockCourseData,
        optimizedContent,
        mockWeatherData,
        mockNearbyAmenities
      );

      expect(seoMetadata.title).toContain('Pebble Beach Golf Links');
      expect(seoMetadata.title).toContain('CA');
      expect(seoMetadata.title.length).toBeLessThanOrEqual(60);
    });

    it('should generate description with key course features', async () => {
      const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

      const seoMetadata = await generateSEOMetadata(
        mockCourseData,
        optimizedContent,
        mockWeatherData,
        mockNearbyAmenities
      );

      expect(seoMetadata.description).toContain('golf');
      expect(seoMetadata.description).toContain('course');
      expect(seoMetadata.description.length).toBeGreaterThan(50);
      expect(seoMetadata.description.length).toBeLessThanOrEqual(160);
    });

    it('should generate relevant keywords array', async () => {
      const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

      const seoMetadata = await generateSEOMetadata(
        mockCourseData,
        optimizedContent,
        mockWeatherData,
        mockNearbyAmenities
      );

      expect(Array.isArray(seoMetadata.keywords)).toBe(true);
      expect(seoMetadata.keywords).toContain('golf course');
      expect(seoMetadata.keywords).toContain('pebble beach');
      expect(seoMetadata.keywords).toContain('ca');
      expect(seoMetadata.keywords.length).toBeGreaterThan(5);
    });
  });

  describe('Content Optimization', () => {
    it('should optimize content for SEO with proper keyword density', () => {
      const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

      expect(optimizedContent.title).toBeDefined();
      expect(optimizedContent.description).toBeDefined();
      expect(optimizedContent.headings).toBeDefined();
      expect(optimizedContent.keywordDensity).toBeDefined();

      // Check keyword density is reasonable (1-10% total)
      const totalKeywordDensity = Object.values(optimizedContent.keywordDensity)
        .reduce((sum, density) => sum + density, 0);
      expect(totalKeywordDensity).toBeGreaterThan(0.01);
      expect(totalKeywordDensity).toBeLessThan(0.10);
    });

    it('should generate proper heading structure', () => {
      const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

      expect(optimizedContent.headings.h1).toBeDefined();
      expect(optimizedContent.headings.h2).toBeDefined();
      expect(optimizedContent.headings.h3).toBeDefined();

      expect(optimizedContent.headings.h1).toContain('Pebble Beach Golf Links');
      expect(optimizedContent.headings.h2.length).toBeGreaterThan(2);
      expect(optimizedContent.headings.h3.length).toBeGreaterThan(3);
    });

    it('should include course-specific keywords', () => {
      const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

      const allText = JSON.stringify(optimizedContent).toLowerCase();
      expect(allText).toContain('golf');
      expect(allText).toContain('course');
      expect(allText).toContain('pebble beach');
      expect(allText).toContain('california');
    });
  });

  describe('Structured Data Generation', () => {
    it('should generate valid JSON-LD structured data', () => {
      const structuredData = generateStructuredData(mockCourseData, mockWeatherData);

      expect(structuredData['@context']).toBe('https://schema.org');
      expect(structuredData['@type']).toBe('GolfCourse');
      expect(structuredData.name).toBe(mockCourseData.name);
      expect(structuredData.address).toBeDefined();
      expect(structuredData.geo).toBeDefined();
    });

    it('should include proper golf course schema properties', () => {
      const structuredData = generateStructuredData(mockCourseData, mockWeatherData);

      expect(structuredData.name).toBe('Pebble Beach Golf Links');
      expect(structuredData.description).toBeDefined();
      expect(structuredData.telephone).toBe('(831) 622-8723');
      expect(structuredData.url).toBe('https://www.pebblebeach.com');
      expect(structuredData.priceRange).toBe('$595-$695');
    });

    it('should include address and location data', () => {
      const structuredData = generateStructuredData(mockCourseData, mockWeatherData);

      expect(structuredData.address).toBeDefined();
      expect(structuredData.address['@type']).toBe('PostalAddress');
      expect(structuredData.address.addressLocality).toBeDefined();
      expect(structuredData.address.addressRegion).toBe('CA');

      expect(structuredData.geo).toBeDefined();
      expect(structuredData.geo['@type']).toBe('GeoCoordinates');
    });

    it('should include amenities and features', () => {
      const structuredData = generateStructuredData(mockCourseData, mockWeatherData);

      expect(structuredData.amenityFeature).toBeDefined();
      expect(Array.isArray(structuredData.amenityFeature)).toBe(true);
      expect(structuredData.amenityFeature.length).toBeGreaterThan(0);
    });
  });

  describe('Social Media Meta Tags', () => {
    it('should generate Open Graph meta tags', async () => {
      const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

      const seoMetadata = await generateSEOMetadata(
        mockCourseData,
        optimizedContent,
        mockWeatherData,
        mockNearbyAmenities
      );

      expect(seoMetadata.openGraph).toBeDefined();
      expect(seoMetadata.openGraph.title).toBeDefined();
      expect(seoMetadata.openGraph.description).toBeDefined();
      expect(seoMetadata.openGraph.type).toBe('website');
      expect(seoMetadata.openGraph.url).toBeDefined();
    });

    it('should generate Twitter Card meta tags', async () => {
      const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

      const seoMetadata = await generateSEOMetadata(
        mockCourseData,
        optimizedContent,
        mockWeatherData,
        mockNearbyAmenities
      );

      expect(seoMetadata.twitter).toBeDefined();
      expect(seoMetadata.twitter.card).toBe('summary_large_image');
      expect(seoMetadata.twitter.title).toBeDefined();
      expect(seoMetadata.twitter.description).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing optional data gracefully', async () => {
      const minimalCourseData = {
        ...mockCourseData,
        phoneNumber: undefined,
        website: undefined,
        greensFeePriceRange: undefined
      };

      const optimizedContent = contentOptimizer.optimizeContentForSEO(minimalCourseData as AutomatedCourseDetails);

      const seoMetadata = await generateSEOMetadata(
        minimalCourseData as AutomatedCourseDetails,
        optimizedContent,
        undefined,
        []
      );

      expect(seoMetadata.title).toBeDefined();
      expect(seoMetadata.description).toBeDefined();
      expect(seoMetadata.keywords).toBeDefined();
    });

    it('should handle invalid or empty course data', () => {
      const invalidCourseData = {
        ...mockCourseData,
        name: '',
        location: '',
        description: ''
      };

      expect(() => {
        contentOptimizer.optimizeContentForSEO(invalidCourseData as AutomatedCourseDetails);
      }).not.toThrow();
    });
  });
});

describe('SEO Performance Validation', () => {
  let contentOptimizer: ContentOptimizer;

  beforeEach(() => {
    contentOptimizer = new ContentOptimizer();
  });

  it('should validate title length for SEO best practices', async () => {
    const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

    const seoMetadata = await generateSEOMetadata(
      mockCourseData,
      optimizedContent,
      mockWeatherData,
      mockNearbyAmenities
    );

    expect(seoMetadata.title.length).toBeGreaterThan(10);
    expect(seoMetadata.title.length).toBeLessThanOrEqual(60);
  });

  it('should validate description length for SEO best practices', async () => {
    const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

    const seoMetadata = await generateSEOMetadata(
      mockCourseData,
      optimizedContent,
      mockWeatherData,
      mockNearbyAmenities
    );

    expect(seoMetadata.description.length).toBeGreaterThan(50);
    expect(seoMetadata.description.length).toBeLessThanOrEqual(160);
  });

  it('should validate keyword relevance and density', () => {
    const optimizedContent = contentOptimizer.generateSEOContent(mockCourseData);

    const keywords = Object.keys(optimizedContent.keywordDensity);
    expect(keywords).toContain('golf');
    expect(keywords).toContain('course');

    // Check that no single keyword dominates (max 3% density)
    Object.values(optimizedContent.keywordDensity).forEach(density => {
      expect(density).toBeLessThan(0.03);
    });
  });
});