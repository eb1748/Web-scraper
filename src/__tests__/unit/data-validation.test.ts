import {
  WeatherDataValidator,
  WikipediaDataValidator,
  CourseHistoricalDataValidator,
  OSMDataValidator,
  CourseEnrichmentValidator,
  dataValidator,
} from '../../utils/data-validation';
import type {
  WeatherData,
  WikipediaData,
  CourseHistoricalData,
  OSMCourseData,
  CourseEnrichmentData,
} from '../../types/api.types';

describe('Data Validation Utilities', () => {
  describe('WeatherDataValidator', () => {
    let validator: WeatherDataValidator;

    beforeEach(() => {
      validator = new WeatherDataValidator();
    });

    it('should validate correct weather data', () => {
      const validWeatherData: WeatherData = {
        current: {
          temperature: 75,
          feelsLike: 78,
          humidity: 60,
          windSpeed: 8,
          windDirection: 270,
          conditions: 'Clear',
          description: 'clear sky',
          visibility: 10,
          pressure: 30,
          dewPoint: 55,
        },
        forecast: [
          {
            date: '2023-12-20',
            tempHigh: 80,
            tempLow: 65,
            precipitation: 0,
            precipitationProbability: 10,
            conditions: 'Partly Cloudy',
            description: 'few clouds',
            windSpeed: 12,
            windDirection: 280,
            humidity: 55,
          },
        ],
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          name: 'San Francisco',
          country: 'US',
          timezone: 'UTC-08:00',
        },
        lastUpdated: new Date(),
        source: 'openweather',
      };

      const result = validator.validate(validWeatherData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing current weather data', () => {
      const invalidWeatherData = {
        forecast: [],
        location: { latitude: 37.7749, longitude: -122.4194, name: 'Test', country: 'US', timezone: 'UTC' },
        lastUpdated: new Date(),
        source: 'openweather',
      } as WeatherData;

      const result = validator.validate(invalidWeatherData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Current weather data is missing');
    });

    it('should detect invalid coordinates', () => {
      const invalidWeatherData: WeatherData = {
        current: {
          temperature: 75,
          feelsLike: 78,
          humidity: 60,
          windSpeed: 8,
          windDirection: 270,
          conditions: 'Clear',
          description: 'clear sky',
          visibility: 10,
          pressure: 30,
          dewPoint: 55,
        },
        forecast: [],
        location: {
          latitude: 200, // Invalid latitude
          longitude: -122.4194,
          name: 'Test Location',
          country: 'US',
          timezone: 'UTC-08:00',
        },
        lastUpdated: new Date(),
        source: 'openweather',
      };

      const result = validator.validate(invalidWeatherData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid coordinates');
    });

    it('should warn about extreme temperatures', () => {
      const extremeWeatherData: WeatherData = {
        current: {
          temperature: 140, // Extreme temperature
          feelsLike: 145,
          humidity: 60,
          windSpeed: 8,
          windDirection: 270,
          conditions: 'Clear',
          description: 'clear sky',
          visibility: 10,
          pressure: 30,
          dewPoint: 55,
        },
        forecast: [],
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          name: 'Test Location',
          country: 'US',
          timezone: 'UTC-08:00',
        },
        lastUpdated: new Date(),
        source: 'openweather',
      };

      const result = validator.validate(extremeWeatherData);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Temperature seems extreme');
    });

    it('should clean weather data correctly', () => {
      const dirtyWeatherData: WeatherData = {
        current: {
          temperature: 75.7,
          feelsLike: 78.3,
          humidity: 60.5,
          windSpeed: 8.9,
          windDirection: 270,
          conditions: '  Clear Sky  ',
          description: '  clear sky with some reference [1]  ',
          visibility: 10,
          pressure: 30,
          dewPoint: 55,
        },
        forecast: [],
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          name: '  San Francisco Golf Course  ',
          country: 'US',
          timezone: 'UTC-08:00',
        },
        lastUpdated: new Date(),
        source: 'openweather',
      };

      const cleaned = validator.clean(dirtyWeatherData);

      expect(cleaned.current.temperature).toBe(76); // Rounded
      expect(cleaned.current.feelsLike).toBe(78); // Rounded
      expect(cleaned.current.windSpeed).toBe(9); // Rounded
      expect(cleaned.current.conditions).toBe('Clear Sky'); // Trimmed
      expect(cleaned.current.description).toBe('clear sky with some reference'); // Cleaned
      expect(cleaned.location.name).toBe('San Francisco Golf Course'); // Trimmed
    });
  });

  describe('WikipediaDataValidator', () => {
    let validator: WikipediaDataValidator;

    beforeEach(() => {
      validator = new WikipediaDataValidator();
    });

    it('should validate correct Wikipedia data', () => {
      const validWikipediaData: WikipediaData = {
        summary: 'This is a comprehensive summary of the golf course with sufficient detail.',
        history: 'The course was established in 1925 by famous architect Donald Ross.',
        architect: 'Donald Ross',
        openingYear: 1925,
        majorChampionships: ['U.S. Open 1987', 'PGA Championship 2010'],
        notableEvents: ['Historic tournament 1985'],
        references: ['https://example.com/ref1'],
        coordinates: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
        images: ['https://upload.wikimedia.org/image1.jpg'],
        lastUpdated: new Date(),
      };

      const result = validator.validate(validWikipediaData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about short summaries', () => {
      const shortSummaryData: WikipediaData = {
        summary: 'Short', // Too short
        history: '',
        architect: 'Donald Ross',
        openingYear: 1925,
        majorChampionships: [],
        notableEvents: [],
        references: [],
        images: [],
        lastUpdated: new Date(),
      };

      const result = validator.validate(shortSummaryData);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Summary is too short or missing');
    });

    it('should detect invalid opening years', () => {
      const invalidYearData: WikipediaData = {
        summary: 'Valid summary with enough content',
        history: '',
        architect: 'Donald Ross',
        openingYear: 1800, // Too early
        majorChampionships: [],
        notableEvents: [],
        references: [],
        images: [],
        lastUpdated: new Date(),
      };

      const result = validator.validate(invalidYearData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid opening year');
    });

    it('should clean Wikipedia data correctly', () => {
      const dirtyWikipediaData: WikipediaData = {
        summary: '  This is a summary with [edit] markers and [1] references.  ',
        history: 'History with (parenthetical content) and extra  spaces',
        architect: '  Donald Ross (1872-1948)  ',
        openingYear: 1925,
        majorChampionships: ['U.S. Open [1987]', '', 'PGA Championship'],
        notableEvents: ['Event with [edit]', ''],
        references: ['https://valid.com', 'invalid-url', 'https://another-valid.com'],
        images: ['https://valid-image.jpg', 'invalid-image-url'],
        lastUpdated: new Date(),
      };

      const cleaned = validator.clean(dirtyWikipediaData);

      expect(cleaned.summary).toBe('This is a summary with markers and references.');
      expect(cleaned.architect).toBe('Donald Ross');
      expect(cleaned.majorChampionships).toHaveLength(2); // Empty ones filtered out
      expect(cleaned.references).toHaveLength(2); // Invalid URLs filtered out
      expect(cleaned.images).toHaveLength(1); // Invalid URLs filtered out
    });
  });

  describe('CourseHistoricalDataValidator', () => {
    let validator: CourseHistoricalDataValidator;

    beforeEach(() => {
      validator = new CourseHistoricalDataValidator();
    });

    it('should validate correct historical data', () => {
      const validHistoricalData: CourseHistoricalData = {
        architect: 'Donald Ross',
        coArchitects: ['Charles Banks'],
        openingYear: 1925,
        renovationYears: [1980, 2005],
        renovationArchitects: ['Tom Fazio'],
        majorChampionships: [
          {
            tournament: 'U.S. Open',
            years: [1987, 2010],
            winners: [
              { year: 1987, winner: 'Scott Simpson', score: '277' },
              { year: 2010, winner: 'Graeme McDowell', score: '284' },
            ],
          },
        ],
        designPhilosophy: 'Strategic design emphasizing shot placement',
        notableFeatures: ['Elevated greens', 'Deep bunkers'],
        records: [
          {
            type: 'Course Record',
            value: '63',
            holder: 'Tiger Woods',
            date: '2000-07-15',
          },
        ],
        courseChanges: [
          {
            year: 1980,
            description: 'Bunker renovation',
            architect: 'Tom Fazio',
          },
        ],
      };

      const result = validator.validate(validHistoricalData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect renovation before opening', () => {
      const invalidHistoricalData: CourseHistoricalData = {
        architect: 'Donald Ross',
        coArchitects: [],
        openingYear: 1925,
        renovationYears: [1920], // Before opening year
        renovationArchitects: [],
        majorChampionships: [],
        designPhilosophy: '',
        notableFeatures: [],
        records: [],
        courseChanges: [],
      };

      const result = validator.validate(invalidHistoricalData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Renovation year 1920 is before opening year 1925');
    });

    it('should clean historical data correctly', () => {
      const dirtyHistoricalData: CourseHistoricalData = {
        architect: '  Donald Ross (1872-1948)  ',
        coArchitects: ['  Charles Banks  ', '', '  Seth Raynor  '],
        openingYear: 1925,
        renovationYears: [2005, 1980, 1800], // Out of order with invalid year
        renovationArchitects: ['  Tom Fazio  ', ''],
        majorChampionships: [
          {
            tournament: '  U.S. Open  ',
            years: [1987, 1800, 2010], // With invalid year
            winners: [],
          },
        ],
        designPhilosophy: '  Strategic design with [edit] markers  ',
        notableFeatures: ['  Feature 1  ', '', 'Feature 2'],
        records: [],
        courseChanges: [],
      };

      const cleaned = validator.clean(dirtyHistoricalData);

      expect(cleaned.architect).toBe('Donald Ross');
      expect(cleaned.coArchitects).toEqual(['Charles Banks', 'Seth Raynor']);
      expect(cleaned.renovationYears).toEqual([1980, 2005]); // Sorted and filtered
      expect(cleaned.renovationArchitects).toEqual(['Tom Fazio']);
      expect(cleaned.majorChampionships[0].tournament).toBe('U.S. Open');
      expect(cleaned.majorChampionships[0].years).toEqual([1987, 2010]); // Invalid year filtered
      expect(cleaned.designPhilosophy).toBe('Strategic design with markers');
      expect(cleaned.notableFeatures).toEqual(['Feature 1', 'Feature 2']);
    });
  });

  describe('OSMDataValidator', () => {
    let validator: OSMDataValidator;

    beforeEach(() => {
      validator = new OSMDataValidator();
    });

    it('should validate correct OSM data', () => {
      const validOSMData: OSMCourseData = {
        coordinates: [-122.4194, 37.7749],
        address: {
          street: '123 Golf Course Road',
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
          postalCode: '94102',
        },
        amenities: ['parking', 'restaurant'],
        features: ['18 holes', 'par 72'],
        nearbyFeatures: {
          hotels: [
            {
              id: 'hotel-1',
              name: 'Golf Resort',
              type: 'hotel',
              coordinates: [-122.4200, 37.7750],
              distance: 500,
              tags: { tourism: 'hotel' },
            },
          ],
          restaurants: [],
          airports: [],
          attractions: [],
        },
        accessibility: {
          wheelchair: true,
          parking: true,
          publicTransport: [],
        },
        lastUpdated: new Date(),
      };

      const result = validator.validate(validOSMData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid coordinates', () => {
      const invalidOSMData: OSMCourseData = {
        coordinates: [200, 37.7749], // Invalid longitude
        address: {},
        amenities: [],
        features: [],
        nearbyFeatures: { hotels: [], restaurants: [], airports: [], attractions: [] },
        accessibility: { wheelchair: false, parking: false, publicTransport: [] },
        lastUpdated: new Date(),
      };

      const result = validator.validate(invalidOSMData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid coordinate values');
    });

    it('should warn about invalid postal codes', () => {
      const invalidPostalCodeData: OSMCourseData = {
        coordinates: [-122.4194, 37.7749],
        address: {
          postalCode: 'INVALID', // Invalid format
        },
        amenities: [],
        features: [],
        nearbyFeatures: { hotels: [], restaurants: [], airports: [], attractions: [] },
        accessibility: { wheelchair: false, parking: false, publicTransport: [] },
        lastUpdated: new Date(),
      };

      const result = validator.validate(invalidPostalCodeData);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Postal code format may be invalid');
    });

    it('should clean OSM data correctly', () => {
      const dirtyOSMData: OSMCourseData = {
        coordinates: [-122.4194, 37.7749],
        address: {
          street: '  123 Golf Course Road  ',
          city: '  San Francisco  ',
          state: '  CA  ',
          postalCode: '  94102  ',
        },
        amenities: ['  parking  ', '', '  restaurant  '],
        features: ['  18 holes  ', ''],
        nearbyFeatures: {
          hotels: [
            {
              id: 'hotel-1',
              name: '  Golf Resort Hotel  ',
              type: '  hotel  ',
              coordinates: [-122.4200, 37.7750],
              distance: 500,
              tags: { tourism: 'hotel' },
            },
          ],
          restaurants: [],
          airports: [],
          attractions: [],
        },
        accessibility: { wheelchair: false, parking: false, publicTransport: [] },
        lastUpdated: new Date(),
      };

      const cleaned = validator.clean(dirtyOSMData);

      expect(cleaned.address.street).toBe('123 Golf Course Road');
      expect(cleaned.address.city).toBe('San Francisco');
      expect(cleaned.address.state).toBe('CA');
      expect(cleaned.address.postalCode).toBe('94102');
      expect(cleaned.amenities).toEqual(['parking', 'restaurant']);
      expect(cleaned.features).toEqual(['18 holes']);
      expect(cleaned.nearbyFeatures.hotels[0].name).toBe('Golf Resort Hotel');
    });
  });

  describe('CourseEnrichmentValidator', () => {
    let validator: CourseEnrichmentValidator;

    beforeEach(() => {
      validator = new CourseEnrichmentValidator();
    });

    it('should validate complete enrichment data', () => {
      const validEnrichmentData: CourseEnrichmentData = {
        weather: {
          current: {
            temperature: 75,
            feelsLike: 78,
            humidity: 60,
            windSpeed: 8,
            windDirection: 270,
            conditions: 'Clear',
            description: 'clear sky',
            visibility: 10,
            pressure: 30,
            dewPoint: 55,
          },
          forecast: [],
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            name: 'Test Location',
            country: 'US',
            timezone: 'UTC-08:00',
          },
          lastUpdated: new Date(),
          source: 'openweather',
        },
        historical: {
          architect: 'Donald Ross',
          coArchitects: [],
          openingYear: 1925,
          renovationYears: [],
          renovationArchitects: [],
          majorChampionships: [],
          designPhilosophy: 'Strategic design',
          notableFeatures: [],
          records: [],
          courseChanges: [],
        },
        location: {
          coordinates: [-122.4194, 37.7749],
          address: { city: 'San Francisco', state: 'CA' },
          amenities: [],
          features: [],
          nearbyFeatures: { hotels: [], restaurants: [], airports: [], attractions: [] },
          accessibility: { wheelchair: false, parking: false, publicTransport: [] },
          lastUpdated: new Date(),
        },
        enrichmentMetadata: {
          sources: ['openweather', 'wikipedia', 'osm'],
          lastUpdated: new Date(),
          confidence: 85,
          dataCompleteness: 90,
          errors: [],
        },
      };

      const result = validator.validate(validEnrichmentData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing enrichment metadata', () => {
      const invalidEnrichmentData = {
        weather: {
          current: { temperature: 75 },
          forecast: [],
          location: { latitude: 37.7749, longitude: -122.4194, name: 'Test', country: 'US', timezone: 'UTC' },
          lastUpdated: new Date(),
          source: 'openweather',
        },
      } as CourseEnrichmentData;

      const result = validator.validate(invalidEnrichmentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Enrichment metadata is missing');
    });

    it('should calculate confidence and completeness scores', () => {
      const enrichmentData: CourseEnrichmentData = {
        weather: {
          current: {
            temperature: 75,
            feelsLike: 78,
            humidity: 60,
            windSpeed: 8,
            windDirection: 270,
            conditions: 'Clear',
            description: 'clear sky',
            visibility: 10,
            pressure: 30,
            dewPoint: 55,
          },
          forecast: [],
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            name: 'Test Location',
            country: 'US',
            timezone: 'UTC-08:00',
          },
          lastUpdated: new Date(),
          source: 'openweather',
        },
        historical: {
          architect: 'Donald Ross',
          coArchitects: [],
          openingYear: 1925,
          renovationYears: [],
          renovationArchitects: [],
          majorChampionships: [],
          designPhilosophy: '',
          notableFeatures: [],
          records: [],
          courseChanges: [],
        },
        enrichmentMetadata: {
          sources: ['openweather', 'wikipedia'],
          lastUpdated: new Date(),
          confidence: 0, // Will be recalculated
          dataCompleteness: 0, // Will be recalculated
          errors: [],
        },
      };

      const cleaned = validator.clean(enrichmentData);

      expect(cleaned.enrichmentMetadata.confidence).toBeGreaterThan(0);
      expect(cleaned.enrichmentMetadata.dataCompleteness).toBeGreaterThan(0);
    });
  });

  describe('DataValidationUtility', () => {
    it('should validate data by type', () => {
      const weatherData: WeatherData = {
        current: {
          temperature: 75,
          feelsLike: 78,
          humidity: 60,
          windSpeed: 8,
          windDirection: 270,
          conditions: 'Clear',
          description: 'clear sky',
          visibility: 10,
          pressure: 30,
          dewPoint: 55,
        },
        forecast: [],
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          name: 'Test Location',
          country: 'US',
          timezone: 'UTC-08:00',
        },
        lastUpdated: new Date(),
        source: 'openweather',
      };

      const result = dataValidator.validate('weather', weatherData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should clean data by type', () => {
      const dirtyWeatherData: WeatherData = {
        current: {
          temperature: 75.7,
          feelsLike: 78.3,
          humidity: 60,
          windSpeed: 8.9,
          windDirection: 270,
          conditions: '  Clear  ',
          description: 'clear sky',
          visibility: 10,
          pressure: 30,
          dewPoint: 55,
        },
        forecast: [],
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          name: '  Test Location  ',
          country: 'US',
          timezone: 'UTC-08:00',
        },
        lastUpdated: new Date(),
        source: 'openweather',
      };

      const cleaned = dataValidator.clean('weather', dirtyWeatherData);

      expect(cleaned.current.temperature).toBe(76); // Rounded
      expect(cleaned.current.conditions).toBe('Clear'); // Trimmed
      expect(cleaned.location.name).toBe('Test Location'); // Trimmed
    });

    it('should validate and clean in one operation', () => {
      const weatherData: WeatherData = {
        current: {
          temperature: 75.5,
          feelsLike: 78,
          humidity: 60,
          windSpeed: 8,
          windDirection: 270,
          conditions: 'Clear',
          description: 'clear sky',
          visibility: 10,
          pressure: 30,
          dewPoint: 55,
        },
        forecast: [],
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          name: 'Test Location',
          country: 'US',
          timezone: 'UTC-08:00',
        },
        lastUpdated: new Date(),
        source: 'openweather',
      };

      const { result, cleanedData } = dataValidator.validateAndClean('weather', weatherData);

      expect(result.valid).toBe(true);
      expect(cleanedData.current.temperature).toBe(76); // Rounded during cleaning
    });

    it('should handle validation errors gracefully', () => {
      const invalidData = null;

      const result = dataValidator.validate('weather', invalidData as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});