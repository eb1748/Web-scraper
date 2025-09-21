import { generateStructuredData } from '../../services/seo/structured-data-generator';
import type { AutomatedCourseDetails } from '../../types/quality.types';

// Schema.org validation helpers
interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Mock course data for testing
const mockCourseData: AutomatedCourseDetails = {
  id: 'test-augusta-national',
  name: 'Augusta National Golf Club',
  location: 'Augusta, GA 30904',
  state: 'GA',
  description: 'Augusta National Golf Club is a prestigious private golf club in Augusta, Georgia, home to the Masters Tournament.',
  phoneNumber: '(706) 667-6000',
  website: 'https://www.masters.com',
  greensFeePriceRange: 'Private Club',
  publicAccess: false,
  cartRequired: true,
  courseType: 'Private',
  numberOfHoles: 18,
  totalYardage: 7475,
  courseRating: 76.2,
  slopeRating: 137,
  establishedYear: 1933,
  architect: 'Alister MacKenzie, Bobby Jones',
  designedBy: 'Alister MacKenzie and Bobby Jones',
  par: 72,
  difficulty: 'Championship',
  drivingRange: true,
  puttingGreen: true,
  chippingGreen: true,
  proShop: true,
  restaurant: true,
  clubhouse: true,
  rentals: false,
  lessons: true,
  membershipAvailable: true,
  teeTimeBookingUrl: undefined,
  qualityScore: 100,
  completenessScore: 100,
  lastUpdated: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockWeatherData = {
  current: {
    temperature: 78,
    description: 'Clear skies',
    windSpeed: 5,
    humidity: 45
  },
  forecast: [
    {
      date: '2025-01-15',
      high: 82,
      low: 58,
      description: 'Sunny',
      playabilityScore: 98
    }
  ]
};

/**
 * Validates Schema.org structured data compliance
 */
function validateSchemaOrgStructure(data: any): SchemaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required Schema.org properties
  if (!data['@context']) {
    errors.push('Missing required @context property');
  } else if (data['@context'] !== 'https://schema.org') {
    errors.push('Invalid @context value, should be "https://schema.org"');
  }

  if (!data['@type']) {
    errors.push('Missing required @type property');
  } else if (data['@type'] !== 'GolfCourse') {
    errors.push('Invalid @type value for golf course, should be "GolfCourse"');
  }

  // Validate required properties for GolfCourse schema
  const requiredProperties = ['name', 'address', 'description'];
  requiredProperties.forEach(prop => {
    if (!data[prop]) {
      errors.push(`Missing required property: ${prop}`);
    }
  });

  // Validate address structure
  if (data.address) {
    if (!data.address['@type'] || data.address['@type'] !== 'PostalAddress') {
      errors.push('Address must have @type of "PostalAddress"');
    }
    if (!data.address.addressLocality) {
      warnings.push('Address should include addressLocality');
    }
    if (!data.address.addressRegion) {
      warnings.push('Address should include addressRegion');
    }
  }

  // Validate geo coordinates
  if (data.geo) {
    if (!data.geo['@type'] || data.geo['@type'] !== 'GeoCoordinates') {
      errors.push('Geo coordinates must have @type of "GeoCoordinates"');
    }
    if (typeof data.geo.latitude !== 'number' || typeof data.geo.longitude !== 'number') {
      errors.push('Geo coordinates must include numeric latitude and longitude');
    }
  }

  // Validate contact information
  if (data.telephone && typeof data.telephone !== 'string') {
    errors.push('Telephone must be a string');
  }

  if (data.url && typeof data.url !== 'string') {
    errors.push('URL must be a string');
  }

  // Validate amenities structure
  if (data.amenityFeature) {
    if (!Array.isArray(data.amenityFeature)) {
      errors.push('amenityFeature must be an array');
    } else {
      data.amenityFeature.forEach((amenity: any, index: number) => {
        if (!amenity['@type'] || amenity['@type'] !== 'LocationFeatureSpecification') {
          errors.push(`Amenity ${index} must have @type of "LocationFeatureSpecification"`);
        }
        if (!amenity.name) {
          errors.push(`Amenity ${index} must have a name`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates JSON-LD syntax
 */
function validateJSONLD(data: any): SchemaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Test JSON serialization
    const jsonString = JSON.stringify(data);
    const parsed = JSON.parse(jsonString);

    // Verify data integrity after serialization
    if (parsed['@context'] !== data['@context']) {
      errors.push('Data corruption during JSON serialization');
    }

    // Check for circular references
    const seen = new Set();
    function checkCircular(obj: any, path = ''): void {
      if (obj && typeof obj === 'object') {
        if (seen.has(obj)) {
          errors.push(`Circular reference detected at ${path}`);
          return;
        }
        seen.add(obj);
        Object.keys(obj).forEach(key => {
          checkCircular(obj[key], path ? `${path}.${key}` : key);
        });
        seen.delete(obj);
      }
    }
    checkCircular(data);

  } catch (error) {
    errors.push(`JSON-LD serialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

describe('Structured Data Validation', () => {
  let structuredData: any;

  beforeEach(() => {
    structuredData = generateStructuredData(mockCourseData, mockWeatherData);
  });

  describe('Schema.org Compliance', () => {
    it('should generate valid Schema.org structured data', () => {
      const validation = validateSchemaOrgStructure(structuredData);

      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.log('Schema.org validation errors:', validation.errors);
        console.log('Schema.org validation warnings:', validation.warnings);
      }
      expect(validation.errors).toHaveLength(0);
    });

    it('should include required Schema.org properties', () => {
      expect(structuredData['@context']).toBe('https://schema.org');
      expect(structuredData['@type']).toBe('GolfCourse');
      expect(structuredData.name).toBe(mockCourseData.name);
      expect(structuredData.description).toBeDefined();
      expect(structuredData.address).toBeDefined();
    });

    it('should have properly structured address', () => {
      expect(structuredData.address).toBeDefined();
      expect(structuredData.address['@type']).toBe('PostalAddress');
      expect(structuredData.address.addressLocality).toBeDefined();
      expect(structuredData.address.addressRegion).toBeDefined();
      expect(structuredData.address.addressCountry).toBe('US');
    });

    it('should include valid geo coordinates', () => {
      expect(structuredData.geo).toBeDefined();
      expect(structuredData.geo['@type']).toBe('GeoCoordinates');
      expect(typeof structuredData.geo.latitude).toBe('number');
      expect(typeof structuredData.geo.longitude).toBe('number');
      expect(structuredData.geo.latitude).toBeGreaterThan(-90);
      expect(structuredData.geo.latitude).toBeLessThan(90);
      expect(structuredData.geo.longitude).toBeGreaterThan(-180);
      expect(structuredData.geo.longitude).toBeLessThan(180);
    });

    it('should include contact information when available', () => {
      if (mockCourseData.phoneNumber) {
        expect(structuredData.telephone).toBe(mockCourseData.phoneNumber);
      }
      if (mockCourseData.website) {
        expect(structuredData.url).toBe(mockCourseData.website);
      }
    });

    it('should include amenities as LocationFeatureSpecification', () => {
      expect(structuredData.amenityFeature).toBeDefined();
      expect(Array.isArray(structuredData.amenityFeature)).toBe(true);

      structuredData.amenityFeature.forEach((amenity: any) => {
        expect(amenity['@type']).toBe('LocationFeatureSpecification');
        expect(amenity.name).toBeDefined();
        expect(typeof amenity.name).toBe('string');
      });
    });

    it('should include sports activity type', () => {
      expect(structuredData.sport).toBe('Golf');
      expect(structuredData.category).toBe('GolfCourse');
    });
  });

  describe('JSON-LD Validation', () => {
    it('should generate valid JSON-LD syntax', () => {
      const validation = validateJSONLD(structuredData);

      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.log('JSON-LD validation errors:', validation.errors);
      }
      expect(validation.errors).toHaveLength(0);
    });

    it('should be serializable to JSON', () => {
      expect(() => {
        JSON.stringify(structuredData);
      }).not.toThrow();

      const serialized = JSON.stringify(structuredData);
      expect(serialized).toBeDefined();
      expect(serialized.length).toBeGreaterThan(100);
    });

    it('should be parseable from JSON', () => {
      const serialized = JSON.stringify(structuredData);
      const parsed = JSON.parse(serialized);

      expect(parsed['@context']).toBe(structuredData['@context']);
      expect(parsed['@type']).toBe(structuredData['@type']);
      expect(parsed.name).toBe(structuredData.name);
    });

    it('should not contain circular references', () => {
      const validation = validateJSONLD(structuredData);

      const circularErrors = validation.errors.filter(error =>
        error.includes('circular') || error.includes('Circular')
      );
      expect(circularErrors).toHaveLength(0);
    });
  });

  describe('Golf Course Specific Properties', () => {
    it('should include golf course specific schema properties', () => {
      // Core golf course properties
      expect(structuredData.sport).toBe('Golf');
      expect(typeof structuredData.numberOfHoles).toBe('number');
      expect(structuredData.numberOfHoles).toBe(mockCourseData.numberOfHoles);

      if (mockCourseData.par) {
        expect(typeof structuredData.par).toBe('number');
        expect(structuredData.par).toBe(mockCourseData.par);
      }

      if (mockCourseData.totalYardage) {
        expect(typeof structuredData.courseLength).toBe('number');
        expect(structuredData.courseLength).toBe(mockCourseData.totalYardage);
      }
    });

    it('should include course designer information', () => {
      if (mockCourseData.architect) {
        expect(structuredData.architect).toBeDefined();
        expect(structuredData.architect).toBe(mockCourseData.architect);
      }
    });

    it('should include establishment year', () => {
      if (mockCourseData.establishedYear) {
        expect(structuredData.foundingDate).toBeDefined();
        expect(structuredData.foundingDate).toBe(mockCourseData.establishedYear.toString());
      }
    });

    it('should include pricing information when available', () => {
      if (mockCourseData.greensFeePriceRange) {
        expect(structuredData.priceRange).toBe(mockCourseData.greensFeePriceRange);
      }
    });
  });

  describe('Rich Snippets Compatibility', () => {
    it('should include properties for Google rich snippets', () => {
      // Essential properties for Google golf course rich snippets
      expect(structuredData.name).toBeDefined();
      expect(structuredData.address).toBeDefined();
      expect(structuredData.geo).toBeDefined();
      expect(structuredData.description).toBeDefined();
    });

    it('should include rating if available', () => {
      // If we have quality score, it should be converted to aggregate rating
      if (mockCourseData.qualityScore) {
        expect(structuredData.aggregateRating).toBeDefined();
        expect(structuredData.aggregateRating['@type']).toBe('AggregateRating');
        expect(typeof structuredData.aggregateRating.ratingValue).toBe('number');
        expect(structuredData.aggregateRating.bestRating).toBe(5);
      }
    });

    it('should include operating hours if available', () => {
      // Check if operating hours are structured properly
      if (structuredData.openingHours) {
        expect(Array.isArray(structuredData.openingHours)).toBe(true);
      }
    });
  });

  describe('Error Handling in Structured Data', () => {
    it('should handle missing optional course data gracefully', () => {
      const minimalCourseData = {
        ...mockCourseData,
        phoneNumber: undefined,
        website: undefined,
        architect: undefined,
        establishedYear: undefined,
        greensFeePriceRange: undefined
      };

      const minimalStructuredData = generateStructuredData(
        minimalCourseData as AutomatedCourseDetails,
        mockWeatherData
      );

      const validation = validateSchemaOrgStructure(minimalStructuredData);
      expect(validation.valid).toBe(true);
    });

    it('should handle missing weather data gracefully', () => {
      const structuredDataNoWeather = generateStructuredData(mockCourseData, undefined);

      const validation = validateSchemaOrgStructure(structuredDataNoWeather);
      expect(validation.valid).toBe(true);
    });

    it('should generate valid schema with minimal required data only', () => {
      const minimalCourse = {
        id: 'minimal-course',
        name: 'Test Golf Course',
        location: 'Test City, ST 12345',
        description: 'A test golf course',
        qualityScore: 80,
        completenessScore: 80,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const minimalStructuredData = generateStructuredData(
        minimalCourse as AutomatedCourseDetails,
        undefined
      );

      const validation = validateSchemaOrgStructure(minimalStructuredData);
      expect(validation.valid).toBe(true);
      expect(minimalStructuredData.name).toBe('Test Golf Course');
      expect(minimalStructuredData['@type']).toBe('GolfCourse');
    });
  });
});

describe('Structured Data Performance', () => {
  it('should generate structured data efficiently', () => {
    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      generateStructuredData(mockCourseData, mockWeatherData);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should generate 100 structured data objects in under 1 second
    expect(totalTime).toBeLessThan(1000);
  });

  it('should produce consistent output for the same input', () => {
    const structuredData1 = generateStructuredData(mockCourseData, mockWeatherData);
    const structuredData2 = generateStructuredData(mockCourseData, mockWeatherData);

    expect(JSON.stringify(structuredData1)).toBe(JSON.stringify(structuredData2));
  });

  it('should generate compact JSON-LD output', () => {
    const testStructuredData = generateStructuredData(mockCourseData, mockWeatherData);
    const serialized = JSON.stringify(testStructuredData);

    // Should be comprehensive but not bloated
    expect(serialized.length).toBeGreaterThan(500);
    expect(serialized.length).toBeLessThan(5000);
  });
});