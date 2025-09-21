import type {
  ValidationResult,
  DataValidator,
  WeatherData,
  WikipediaData,
  CourseHistoricalData,
  OSMCourseData,
  CourseEnrichmentData,
} from '../types/api.types';
import { apiLogger } from './logger';

/**
 * Base data validator with common validation utilities
 */
abstract class BaseValidator<T> implements DataValidator<T> {
  abstract validate(data: T): ValidationResult;
  abstract clean(data: T): T;

  isValid(data: T): boolean {
    return this.validate(data).valid;
  }

  /**
   * Clean text content
   */
  protected cleanText(text: string): string {
    if (!text || typeof text !== 'string') return '';

    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\[\d+\]/g, '') // Remove reference numbers
      .replace(/\[edit\]/g, '') // Remove edit markers
      .replace(/\([^)]*\)/g, '') // Remove parenthetical content
      .trim();
  }

  /**
   * Validate coordinate
   */
  protected isValidCoordinate(lat: number, lon: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      lat >= -90 && lat <= 90 &&
      lon >= -180 && lon <= 180 &&
      !isNaN(lat) && !isNaN(lon)
    );
  }

  /**
   * Validate year
   */
  protected isValidYear(year: number): boolean {
    const currentYear = new Date().getFullYear();
    return (
      typeof year === 'number' &&
      year >= 1850 && // Earliest golf courses
      year <= currentYear &&
      !isNaN(year)
    );
  }

  /**
   * Validate URL
   */
  protected isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize name
   */
  protected normalizeName(name: string): string {
    if (!name) return '';

    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.'&]/g, '') // Keep only word chars, spaces, hyphens, periods, apostrophes, ampersands
      .substring(0, 100); // Limit length
  }

  /**
   * Calculate confidence score based on data completeness
   */
  protected calculateConfidence(requiredFields: any[], optionalFields: any[]): number {
    const requiredCount = requiredFields.filter(field =>
      field !== null && field !== undefined && field !== ''
    ).length;

    const optionalCount = optionalFields.filter(field =>
      field !== null && field !== undefined && field !== ''
    ).length;

    const requiredScore = (requiredCount / requiredFields.length) * 70; // 70% for required fields
    const optionalScore = (optionalCount / optionalFields.length) * 30; // 30% for optional fields

    return Math.round(requiredScore + optionalScore);
  }
}

/**
 * Weather data validator
 */
export class WeatherDataValidator extends BaseValidator<WeatherData> {
  validate(data: WeatherData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate current weather
    if (!data.current) {
      errors.push('Current weather data is missing');
    } else {
      if (typeof data.current.temperature !== 'number') {
        errors.push('Temperature is not a number');
      } else if (data.current.temperature < -100 || data.current.temperature > 150) {
        warnings.push('Temperature seems extreme');
      }

      if (typeof data.current.humidity !== 'number' || data.current.humidity < 0 || data.current.humidity > 100) {
        errors.push('Invalid humidity value');
      }

      if (typeof data.current.windSpeed !== 'number' || data.current.windSpeed < 0 || data.current.windSpeed > 200) {
        warnings.push('Wind speed seems extreme');
      }
    }

    // Validate location
    if (!data.location) {
      errors.push('Location data is missing');
    } else {
      if (!this.isValidCoordinate(data.location.latitude, data.location.longitude)) {
        errors.push('Invalid coordinates');
      }

      if (!data.location.name || data.location.name.trim() === '') {
        warnings.push('Location name is missing');
      }
    }

    // Validate forecast
    if (data.forecast && Array.isArray(data.forecast)) {
      data.forecast.forEach((day, index) => {
        if (!day.date) {
          errors.push(`Forecast day ${index + 1} missing date`);
        }

        if (typeof day.tempHigh !== 'number' || typeof day.tempLow !== 'number') {
          errors.push(`Forecast day ${index + 1} has invalid temperatures`);
        }

        if (day.tempHigh < day.tempLow) {
          warnings.push(`Forecast day ${index + 1}: high temp lower than low temp`);
        }
      });
    }

    // Validate timestamps
    if (!data.lastUpdated || !(data.lastUpdated instanceof Date)) {
      errors.push('Invalid or missing lastUpdated timestamp');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cleaned: false,
      originalValue: data,
      cleanedValue: data,
    };
  }

  clean(data: WeatherData): WeatherData {
    const cleaned = { ...data };

    // Clean location name
    if (cleaned.location && cleaned.location.name) {
      cleaned.location.name = this.normalizeName(cleaned.location.name);
    }

    // Clean weather conditions
    if (cleaned.current) {
      cleaned.current.conditions = this.cleanText(cleaned.current.conditions);
      cleaned.current.description = this.cleanText(cleaned.current.description);

      // Round numeric values
      cleaned.current.temperature = Math.round(cleaned.current.temperature);
      cleaned.current.feelsLike = Math.round(cleaned.current.feelsLike);
      cleaned.current.windSpeed = Math.round(cleaned.current.windSpeed);
      cleaned.current.humidity = Math.round(cleaned.current.humidity);
    }

    // Clean forecast data
    if (cleaned.forecast) {
      cleaned.forecast = cleaned.forecast.map(day => ({
        ...day,
        conditions: this.cleanText(day.conditions),
        description: this.cleanText(day.description),
        tempHigh: Math.round(day.tempHigh),
        tempLow: Math.round(day.tempLow),
        windSpeed: Math.round(day.windSpeed),
        humidity: Math.round(day.humidity),
      }));
    }

    return cleaned;
  }
}

/**
 * Wikipedia data validator
 */
export class WikipediaDataValidator extends BaseValidator<WikipediaData> {
  validate(data: WikipediaData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate summary
    if (!data.summary || data.summary.length < 10) {
      warnings.push('Summary is too short or missing');
    } else if (data.summary.length > 2000) {
      warnings.push('Summary is very long');
    }

    // Validate architect
    if (data.architect && data.architect.length > 100) {
      warnings.push('Architect name seems too long');
    }

    // Validate opening year
    if (data.openingYear && !this.isValidYear(data.openingYear)) {
      errors.push('Invalid opening year');
    }

    // Validate coordinates
    if (data.coordinates) {
      if (!this.isValidCoordinate(data.coordinates.latitude, data.coordinates.longitude)) {
        errors.push('Invalid coordinates');
      }
    }

    // Validate images
    if (data.images && Array.isArray(data.images)) {
      data.images.forEach((image, index) => {
        if (!this.isValidUrl(image)) {
          warnings.push(`Image ${index + 1} has invalid URL`);
        }
      });
    }

    // Validate references
    if (data.references && Array.isArray(data.references)) {
      data.references.forEach((ref, index) => {
        if (!this.isValidUrl(ref)) {
          warnings.push(`Reference ${index + 1} has invalid URL`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cleaned: false,
      originalValue: data,
      cleanedValue: data,
    };
  }

  clean(data: WikipediaData): WikipediaData {
    const cleaned = { ...data };

    // Clean text fields
    cleaned.summary = this.cleanText(cleaned.summary);
    cleaned.history = this.cleanText(cleaned.history);
    cleaned.architect = this.cleanText(cleaned.architect);

    // Clean arrays
    if (cleaned.majorChampionships) {
      cleaned.majorChampionships = cleaned.majorChampionships
        .map(champ => this.cleanText(champ))
        .filter(champ => champ.length > 0);
    }

    if (cleaned.notableEvents) {
      cleaned.notableEvents = cleaned.notableEvents
        .map(event => this.cleanText(event))
        .filter(event => event.length > 0);
    }

    // Validate and clean URLs
    if (cleaned.images) {
      cleaned.images = cleaned.images.filter(img => this.isValidUrl(img));
    }

    if (cleaned.references) {
      cleaned.references = cleaned.references.filter(ref => this.isValidUrl(ref));
    }

    // Limit array sizes
    cleaned.majorChampionships = cleaned.majorChampionships?.slice(0, 20) || [];
    cleaned.notableEvents = cleaned.notableEvents?.slice(0, 15) || [];
    cleaned.images = cleaned.images?.slice(0, 10) || [];
    cleaned.references = cleaned.references?.slice(0, 15) || [];

    return cleaned;
  }
}

/**
 * Course historical data validator
 */
export class CourseHistoricalDataValidator extends BaseValidator<CourseHistoricalData> {
  validate(data: CourseHistoricalData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate opening year
    if (data.openingYear && !this.isValidYear(data.openingYear)) {
      errors.push('Invalid opening year');
    }

    // Validate renovation years
    if (data.renovationYears && Array.isArray(data.renovationYears)) {
      data.renovationYears.forEach((year, index) => {
        if (!this.isValidYear(year)) {
          errors.push(`Invalid renovation year at index ${index}`);
        }

        if (data.openingYear && year < data.openingYear) {
          errors.push(`Renovation year ${year} is before opening year ${data.openingYear}`);
        }
      });
    }

    // Validate architects
    if (data.architect && data.architect.length > 100) {
      warnings.push('Primary architect name is very long');
    }

    if (data.coArchitects && data.coArchitects.length > 10) {
      warnings.push('Too many co-architects listed');
    }

    // Validate championships
    if (data.majorChampionships && Array.isArray(data.majorChampionships)) {
      data.majorChampionships.forEach((championship, index) => {
        if (!championship.tournament || championship.tournament.length === 0) {
          warnings.push(`Championship ${index + 1} missing tournament name`);
        }

        if (championship.years && Array.isArray(championship.years)) {
          championship.years.forEach(year => {
            if (!this.isValidYear(year)) {
              warnings.push(`Invalid championship year: ${year}`);
            }
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cleaned: false,
      originalValue: data,
      cleanedValue: data,
    };
  }

  clean(data: CourseHistoricalData): CourseHistoricalData {
    const cleaned = { ...data };

    // Clean text fields
    cleaned.architect = this.cleanText(cleaned.architect);
    cleaned.designPhilosophy = this.cleanText(cleaned.designPhilosophy);

    // Clean arrays
    if (cleaned.coArchitects) {
      cleaned.coArchitects = cleaned.coArchitects
        .map(arch => this.cleanText(arch))
        .filter(arch => arch.length > 0)
        .slice(0, 5); // Limit to 5 co-architects
    }

    if (cleaned.renovationArchitects) {
      cleaned.renovationArchitects = cleaned.renovationArchitects
        .map(arch => this.cleanText(arch))
        .filter(arch => arch.length > 0)
        .slice(0, 5);
    }

    if (cleaned.notableFeatures) {
      cleaned.notableFeatures = cleaned.notableFeatures
        .map(feature => this.cleanText(feature))
        .filter(feature => feature.length > 0)
        .slice(0, 10);
    }

    // Sort and validate years
    if (cleaned.renovationYears) {
      cleaned.renovationYears = cleaned.renovationYears
        .filter(year => this.isValidYear(year))
        .sort((a, b) => a - b);
    }

    // Clean championship data
    if (cleaned.majorChampionships) {
      cleaned.majorChampionships = cleaned.majorChampionships
        .map(championship => ({
          ...championship,
          tournament: this.cleanText(championship.tournament),
          years: championship.years ? championship.years.filter(year => this.isValidYear(year)).sort() : [],
        }))
        .filter(championship => championship.tournament.length > 0);
    }

    return cleaned;
  }
}

/**
 * OSM course data validator
 */
export class OSMDataValidator extends BaseValidator<OSMCourseData> {
  validate(data: OSMCourseData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate coordinates
    if (!data.coordinates || data.coordinates.length !== 2) {
      errors.push('Invalid coordinates format');
    } else {
      const [lon, lat] = data.coordinates;
      if (!this.isValidCoordinate(lat, lon)) {
        errors.push('Invalid coordinate values');
      }
    }

    // Validate address
    if (data.address) {
      if (data.address.postalCode && !/^\d{5}(-\d{4})?$/.test(data.address.postalCode)) {
        warnings.push('Postal code format may be invalid');
      }
    }

    // Validate nearby features
    if (data.nearbyFeatures) {
      ['hotels', 'restaurants', 'airports', 'attractions'].forEach(category => {
        const features = data.nearbyFeatures[category as keyof typeof data.nearbyFeatures];
        if (features && Array.isArray(features)) {
          features.forEach((poi, index) => {
            if (!poi.coordinates || poi.coordinates.length !== 2) {
              warnings.push(`${category} POI ${index + 1} has invalid coordinates`);
            }

            if (typeof poi.distance !== 'number' || poi.distance < 0) {
              warnings.push(`${category} POI ${index + 1} has invalid distance`);
            }
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cleaned: false,
      originalValue: data,
      cleanedValue: data,
    };
  }

  clean(data: OSMCourseData): OSMCourseData {
    const cleaned = { ...data };

    // Clean address fields
    if (cleaned.address) {
      cleaned.address = {
        street: cleaned.address.street ? this.cleanText(cleaned.address.street) : undefined,
        city: cleaned.address.city ? this.cleanText(cleaned.address.city) : undefined,
        state: cleaned.address.state ? this.cleanText(cleaned.address.state) : undefined,
        country: cleaned.address.country ? this.cleanText(cleaned.address.country) : undefined,
        postalCode: cleaned.address.postalCode ? cleaned.address.postalCode.trim() : undefined,
      };
    }

    // Clean amenities and features
    if (cleaned.amenities) {
      cleaned.amenities = cleaned.amenities
        .map(amenity => this.cleanText(amenity))
        .filter(amenity => amenity.length > 0);
    }

    if (cleaned.features) {
      cleaned.features = cleaned.features
        .map(feature => this.cleanText(feature))
        .filter(feature => feature.length > 0);
    }

    // Clean POI data
    if (cleaned.nearbyFeatures) {
      ['hotels', 'restaurants', 'airports', 'attractions'].forEach(category => {
        const features = cleaned.nearbyFeatures[category as keyof typeof cleaned.nearbyFeatures];
        if (features && Array.isArray(features)) {
          cleaned.nearbyFeatures[category as keyof typeof cleaned.nearbyFeatures] = features
            .map(poi => ({
              ...poi,
              name: this.cleanText(poi.name),
              type: this.cleanText(poi.type),
              address: poi.address ? this.cleanText(poi.address) : undefined,
            }))
            .filter(poi => poi.name.length > 0)
            .slice(0, 20); // Limit POIs per category
        }
      });
    }

    return cleaned;
  }
}

/**
 * Complete course enrichment data validator
 */
export class CourseEnrichmentValidator extends BaseValidator<CourseEnrichmentData> {
  private weatherValidator = new WeatherDataValidator();
  private wikipediaValidator = new WikipediaDataValidator();
  private historicalValidator = new CourseHistoricalDataValidator();
  private osmValidator = new OSMDataValidator();

  validate(data: CourseEnrichmentData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate individual components
    if (data.weather) {
      const weatherResult = this.weatherValidator.validate(data.weather);
      errors.push(...weatherResult.errors.map(e => `Weather: ${e}`));
      warnings.push(...weatherResult.warnings.map(w => `Weather: ${w}`));
    }

    if (data.historical) {
      const historicalResult = this.historicalValidator.validate(data.historical);
      errors.push(...historicalResult.errors.map(e => `Historical: ${e}`));
      warnings.push(...historicalResult.warnings.map(w => `Historical: ${w}`));
    }

    if (data.location) {
      const locationResult = this.osmValidator.validate(data.location);
      errors.push(...locationResult.errors.map(e => `Location: ${e}`));
      warnings.push(...locationResult.warnings.map(w => `Location: ${w}`));
    }

    // Validate enrichment metadata
    if (!data.enrichmentMetadata) {
      errors.push('Enrichment metadata is missing');
    } else {
      if (!Array.isArray(data.enrichmentMetadata.sources) || data.enrichmentMetadata.sources.length === 0) {
        warnings.push('No data sources specified');
      }

      if (typeof data.enrichmentMetadata.confidence !== 'number' ||
          data.enrichmentMetadata.confidence < 0 ||
          data.enrichmentMetadata.confidence > 100) {
        errors.push('Invalid confidence score');
      }

      if (typeof data.enrichmentMetadata.dataCompleteness !== 'number' ||
          data.enrichmentMetadata.dataCompleteness < 0 ||
          data.enrichmentMetadata.dataCompleteness > 100) {
        errors.push('Invalid data completeness score');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cleaned: false,
      originalValue: data,
      cleanedValue: data,
    };
  }

  clean(data: CourseEnrichmentData): CourseEnrichmentData {
    const cleaned = { ...data };

    // Clean individual components
    if (cleaned.weather) {
      cleaned.weather = this.weatherValidator.clean(cleaned.weather);
    }

    if (cleaned.historical) {
      cleaned.historical = this.historicalValidator.clean(cleaned.historical);
    }

    if (cleaned.location) {
      cleaned.location = this.osmValidator.clean(cleaned.location);
    }

    // Clean metadata
    if (cleaned.enrichmentMetadata) {
      cleaned.enrichmentMetadata.sources = cleaned.enrichmentMetadata.sources
        .filter(source => source && source.trim().length > 0)
        .map(source => source.trim());

      cleaned.enrichmentMetadata.errors = cleaned.enrichmentMetadata.errors
        .filter(error => error && error.trim().length > 0)
        .map(error => error.trim());

      // Recalculate confidence and completeness
      cleaned.enrichmentMetadata.confidence = this.calculateOverallConfidence(cleaned);
      cleaned.enrichmentMetadata.dataCompleteness = this.calculateDataCompleteness(cleaned);
    }

    return cleaned;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(data: CourseEnrichmentData): number {
    const scores: number[] = [];

    if (data.weather) {
      scores.push(85); // Weather data is generally reliable
    }

    if (data.historical) {
      // Score based on historical data completeness
      const requiredFields = [data.historical.architect, data.historical.openingYear];
      const optionalFields = [
        data.historical.designPhilosophy,
        data.historical.majorChampionships?.length,
        data.historical.renovationYears?.length,
      ];

      scores.push(this.calculateConfidence(requiredFields, optionalFields));
    }

    if (data.location) {
      // Score based on location data completeness
      const requiredFields = [data.location.coordinates];
      const optionalFields = [
        data.location.address?.street,
        data.location.address?.city,
        data.location.amenities?.length,
        data.location.nearbyFeatures?.hotels?.length,
      ];

      scores.push(this.calculateConfidence(requiredFields, optionalFields));
    }

    return scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  }

  /**
   * Calculate data completeness score
   */
  private calculateDataCompleteness(data: CourseEnrichmentData): number {
    let totalFields = 0;
    let completedFields = 0;

    // Weather completeness
    if (data.weather) {
      totalFields += 5;
      if (data.weather.current) completedFields++;
      if (data.weather.forecast?.length > 0) completedFields++;
      if (data.weather.location) completedFields++;
      if (data.weather.lastUpdated) completedFields++;
      if (data.weather.source) completedFields++;
    }

    // Historical completeness
    if (data.historical) {
      totalFields += 7;
      if (data.historical.architect) completedFields++;
      if (data.historical.openingYear) completedFields++;
      if (data.historical.designPhilosophy) completedFields++;
      if (data.historical.majorChampionships?.length > 0) completedFields++;
      if (data.historical.renovationYears?.length > 0) completedFields++;
      if (data.historical.notableFeatures?.length > 0) completedFields++;
      if (data.historical.records?.length > 0) completedFields++;
    }

    // Location completeness
    if (data.location) {
      totalFields += 6;
      if (data.location.coordinates) completedFields++;
      if (data.location.address?.city) completedFields++;
      if (data.location.amenities?.length > 0) completedFields++;
      if (data.location.features?.length > 0) completedFields++;
      if (data.location.nearbyFeatures?.hotels?.length > 0) completedFields++;
      if (data.location.accessibility) completedFields++;
    }

    return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  }
}

/**
 * Main validation utility
 */
export class DataValidationUtility {
  private validators = {
    weather: new WeatherDataValidator(),
    wikipedia: new WikipediaDataValidator(),
    historical: new CourseHistoricalDataValidator(),
    osm: new OSMDataValidator(),
    enrichment: new CourseEnrichmentValidator(),
  };

  /**
   * Validate data by type
   */
  validate<T>(type: keyof typeof this.validators, data: T): ValidationResult {
    try {
      const validator = this.validators[type] as DataValidator<T>;
      return validator.validate(data);
    } catch (error) {
      apiLogger.error(`Validation error for type ${type}`, error);
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        cleaned: false,
        originalValue: data,
        cleanedValue: data,
      };
    }
  }

  /**
   * Clean data by type
   */
  clean<T>(type: keyof typeof this.validators, data: T): T {
    try {
      const validator = this.validators[type] as DataValidator<T>;
      return validator.clean(data);
    } catch (error) {
      apiLogger.error(`Cleaning error for type ${type}`, error);
      return data;
    }
  }

  /**
   * Validate and clean data in one operation
   */
  validateAndClean<T>(type: keyof typeof this.validators, data: T): {
    result: ValidationResult;
    cleanedData: T;
  } {
    const validator = this.validators[type] as DataValidator<T>;
    const result = validator.validate(data);
    const cleanedData = validator.clean(data);

    return { result, cleanedData };
  }
}

// Export singleton instance
export const dataValidator = new DataValidationUtility();