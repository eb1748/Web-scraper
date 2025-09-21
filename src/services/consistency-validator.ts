import type {
  AutomatedCourseDetails,
  ConsistencyIssue,
} from '../types/quality.types';
// import { apiLogger } from '../utils/logger';

/**
 * Internal data consistency validation
 */
export class ConsistencyValidator {
  private readonly knownArchitects: Record<string, { activePeriod: [number, number]; notableWorks: string[] }> = {
    'Donald Ross': { activePeriod: [1895, 1948], notableWorks: ['Pinehurst No. 2', 'Oakland Hills'] },
    'A.W. Tillinghast': { activePeriod: [1900, 1942], notableWorks: ['Winged Foot', 'Baltusrol'] },
    'Alister MacKenzie': { activePeriod: [1907, 1934], notableWorks: ['Augusta National', 'Cypress Point'] },
    'Robert Trent Jones': { activePeriod: [1930, 2000], notableWorks: ['Hazeltine', 'Spyglass Hill'] },
    'Pete Dye': { activePeriod: [1960, 2020], notableWorks: ['TPC Sawgrass', 'Whistling Straits'] },
    'Jack Nicklaus': { activePeriod: [1970, 2024], notableWorks: ['Muirfield Village', 'PGA West'] },
    'Tom Fazio': { activePeriod: [1975, 2024], notableWorks: ['Shadow Creek', 'Quail Hollow'] },
  };

  private readonly usStateBounds: Record<string, { lat: [number, number]; lon: [number, number] }> = {
    'California': { lat: [32.5, 42.0], lon: [-124.4, -114.1] },
    'Florida': { lat: [24.4, 31.0], lon: [-87.6, -80.0] },
    'Texas': { lat: [25.8, 36.5], lon: [-106.6, -93.5] },
    'New York': { lat: [40.5, 45.0], lon: [-79.8, -71.9] },
    'Arizona': { lat: [31.3, 37.0], lon: [-114.8, -109.0] },
    'North Carolina': { lat: [33.8, 36.6], lon: [-84.3, -75.5] },
    'South Carolina': { lat: [32.0, 35.2], lon: [-83.4, -78.5] },
    'Georgia': { lat: [30.4, 35.0], lon: [-85.6, -80.8] },
    'Nevada': { lat: [35.0, 42.0], lon: [-120.0, -114.0] },
    'Colorado': { lat: [37.0, 41.0], lon: [-109.1, -102.0] },
  };

  /**
   * Validate internal consistency of course data
   */
  validateInternalConsistency(data: AutomatedCourseDetails): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Location consistency checks
    issues.push(...this.validateLocationConsistency(data));

    // Golf course metrics consistency
    issues.push(...this.validateGolfMetricsConsistency(data));

    // Historical consistency checks
    issues.push(...this.validateHistoricalConsistency(data));

    // Format consistency checks
    issues.push(...this.validateFormatConsistency(data));

    // Business logic consistency
    issues.push(...this.validateBusinessLogicConsistency(data));

    return issues.filter(issue => issue !== null);
  }

  /**
   * Validate location-related consistency
   */
  private validateLocationConsistency(data: AutomatedCourseDetails): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Coordinates vs location text consistency
    if (data.latitude && data.longitude && data.location) {
      const locationConsistency = this.validateCoordinateLocationMatch(
        data.latitude,
        data.longitude,
        data.location
      );

      if (!locationConsistency.isConsistent) {
        issues.push({
          type: 'location_mismatch',
          severity: 'warning',
          message: 'Coordinates may not match the specified location',
          affectedFields: ['latitude', 'longitude', 'location'],
        });
      }
    }

    // US coordinates validation
    if (data.latitude && data.longitude) {
      if (!this.areValidUSCoordinates(data.latitude, data.longitude)) {
        if (data.location && (data.location.includes('United States') || data.location.includes('USA'))) {
          issues.push({
            type: 'location_mismatch',
            severity: 'error',
            message: 'Coordinates are outside US bounds but location indicates US course',
            affectedFields: ['latitude', 'longitude', 'location'],
          });
        }
      }
    }

    // State-specific coordinate validation
    if (data.latitude && data.longitude && data.location) {
      const stateConsistency = this.validateStateCoordinates(data.latitude, data.longitude, data.location);
      if (!stateConsistency.isConsistent) {
        issues.push({
          type: 'location_mismatch',
          severity: 'info',
          message: `Coordinates may not be in the expected state: ${stateConsistency.expectedState}`,
          affectedFields: ['latitude', 'longitude', 'location'],
        });
      }
    }

    return issues;
  }

  /**
   * Validate golf course metrics consistency
   */
  private validateGolfMetricsConsistency(data: AutomatedCourseDetails): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Yardage per hole consistency
    if (data.totalYardage && data.numberOfHoles) {
      const avgYardagePerHole = data.totalYardage / data.numberOfHoles;
      if (avgYardagePerHole < 200 || avgYardagePerHole > 600) {
        issues.push({
          type: 'yardage_inconsistency',
          severity: 'warning',
          message: `Average yardage per hole (${Math.round(avgYardagePerHole)}) seems unusual for a golf course`,
          affectedFields: ['totalYardage', 'numberOfHoles'],
        });
      }
    }

    // Par score consistency
    if (data.parScore && data.numberOfHoles) {
      const avgParPerHole = data.parScore / data.numberOfHoles;
      if (avgParPerHole < 3 || avgParPerHole > 5) {
        issues.push({
          type: 'yardage_inconsistency',
          severity: 'warning',
          message: `Average par per hole (${avgParPerHole.toFixed(1)}) is outside normal range (3-5)`,
          affectedFields: ['parScore', 'numberOfHoles'],
        });
      }
    }

    // Course rating consistency
    if (data.courseRating) {
      if (data.courseRating < 60 || data.courseRating > 80) {
        issues.push({
          type: 'format_inconsistency',
          severity: 'info',
          message: `Course rating (${data.courseRating}) is outside typical range (60-80)`,
          affectedFields: ['courseRating'],
        });
      }
    }

    // Slope rating consistency
    if (data.slopeRating) {
      if (data.slopeRating < 55 || data.slopeRating > 155) {
        issues.push({
          type: 'format_inconsistency',
          severity: 'warning',
          message: `Slope rating (${data.slopeRating}) is outside valid range (55-155)`,
          affectedFields: ['slopeRating'],
        });
      }
    }

    // Rating relationship consistency
    if (data.courseRating && data.slopeRating && data.parScore) {
      // Generally, course rating should be close to par score for average golfer
      const ratingParDiff = Math.abs(data.courseRating - data.parScore);
      if (ratingParDiff > 10) {
        issues.push({
          type: 'format_inconsistency',
          severity: 'info',
          message: `Large difference between course rating (${data.courseRating}) and par (${data.parScore})`,
          affectedFields: ['courseRating', 'parScore'],
        });
      }
    }

    return issues;
  }

  /**
   * Validate historical consistency
   */
  private validateHistoricalConsistency(data: AutomatedCourseDetails): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Architect and opening year consistency
    if (data.openingYear && data.architect) {
      const architectInfo = this.knownArchitects[data.architect];
      if (architectInfo) {
        const [startYear, endYear] = architectInfo.activePeriod;
        if (data.openingYear < startYear || data.openingYear > endYear) {
          issues.push({
            type: 'historical_inconsistency',
            severity: 'info',
            message: `Opening year (${data.openingYear}) may not align with ${data.architect}'s known active period (${startYear}-${endYear})`,
            affectedFields: ['openingYear', 'architect'],
          });
        }
      }
    }

    // Opening year reasonableness
    if (data.openingYear) {
      const currentYear = new Date().getFullYear();
      if (data.openingYear > currentYear) {
        issues.push({
          type: 'historical_inconsistency',
          severity: 'error',
          message: `Opening year (${data.openingYear}) is in the future`,
          affectedFields: ['openingYear'],
        });
      }

      if (data.openingYear < 1700) {
        issues.push({
          type: 'historical_inconsistency',
          severity: 'warning',
          message: `Opening year (${data.openingYear}) predates the invention of golf`,
          affectedFields: ['openingYear'],
        });
      }
    }

    return issues;
  }

  /**
   * Validate format consistency
   */
  private validateFormatConsistency(data: AutomatedCourseDetails): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Phone number format consistency
    if (data.phoneNumber) {
      const hasConsistentFormat = this.validatePhoneNumberFormat(data.phoneNumber);
      if (!hasConsistentFormat) {
        issues.push({
          type: 'format_inconsistency',
          severity: 'info',
          message: 'Phone number format could be standardized',
          affectedFields: ['phoneNumber'],
        });
      }
    }

    // URL format consistency
    if (data.website) {
      try {
        const url = new URL(data.website);
        if (!url.protocol.startsWith('http')) {
          issues.push({
            type: 'format_inconsistency',
            severity: 'warning',
            message: 'Website URL should use HTTP or HTTPS protocol',
            affectedFields: ['website'],
          });
        }
      } catch {
        issues.push({
          type: 'format_inconsistency',
          severity: 'error',
          message: 'Website URL format is invalid',
          affectedFields: ['website'],
        });
      }
    }

    // Name format consistency
    if (data.name) {
      if (data.name.length < 3) {
        issues.push({
          type: 'format_inconsistency',
          severity: 'warning',
          message: 'Course name is unusually short',
          affectedFields: ['name'],
        });
      }

      if (data.name.length > 100) {
        issues.push({
          type: 'format_inconsistency',
          severity: 'info',
          message: 'Course name is unusually long',
          affectedFields: ['name'],
        });
      }
    }

    return issues;
  }

  /**
   * Validate business logic consistency
   */
  private validateBusinessLogicConsistency(data: AutomatedCourseDetails): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Public access vs pricing consistency
    if (data.publicAccess === false && data.greensFeePriceRange) {
      // Private courses typically don't advertise green fees
      issues.push({
        type: 'format_inconsistency',
        severity: 'info',
        message: 'Private course should not typically have public green fees listed',
        affectedFields: ['publicAccess', 'greensFeePriceRange'],
      });
    }

    // Cart required logic
    if (data.cartRequired === true && data.totalYardage) {
      if (data.totalYardage < 5000) {
        issues.push({
          type: 'format_inconsistency',
          severity: 'info',
          message: 'Short course with mandatory cart requirement seems unusual',
          affectedFields: ['cartRequired', 'totalYardage'],
        });
      }
    }

    // Course type consistency with metrics (commented out as EXECUTIVE is not in enum)
    // if (data.courseType === 'EXECUTIVE' && data.totalYardage && data.totalYardage > 6000) {
    //   issues.push({
    //     type: 'format_inconsistency',
    //     severity: 'warning',
    //     message: 'Executive course with very long total yardage seems inconsistent',
    //     affectedFields: ['courseType', 'totalYardage'],
    //   });
    // }

    return issues;
  }

  /**
   * Validate coordinate and location text match
   */
  private validateCoordinateLocationMatch(
    lat: number,
    lon: number,
    location: string
  ): { isConsistent: boolean; confidence: number } {
    // Basic US bounds check
    const isUSCoordinate = this.areValidUSCoordinates(lat, lon);
    const locationMentionsUS = location.toLowerCase().includes('united states') ||
                              location.toLowerCase().includes('usa') ||
                              this.containsUSState(location);

    if (isUSCoordinate === locationMentionsUS) {
      return { isConsistent: true, confidence: 0.8 };
    }

    return { isConsistent: false, confidence: 0.3 };
  }

  /**
   * Check if coordinates are within US bounds
   */
  private areValidUSCoordinates(lat: number, lon: number): boolean {
    // Continental US bounds (excluding Alaska and Hawaii for simplicity)
    return lat >= 24.7433195 && lat <= 49.3457868 &&
           lon >= -124.7844079 && lon <= -66.9513812;
  }

  /**
   * Validate coordinates against expected state
   */
  private validateStateCoordinates(
    lat: number,
    lon: number,
    location: string
  ): { isConsistent: boolean; expectedState?: string } {
    for (const [state, bounds] of Object.entries(this.usStateBounds)) {
      if (location.toLowerCase().includes(state.toLowerCase())) {
        const isInBounds = lat >= bounds.lat[0] && lat <= bounds.lat[1] &&
                          lon >= bounds.lon[0] && lon <= bounds.lon[1];
        return { isConsistent: isInBounds, expectedState: state };
      }
    }

    return { isConsistent: true }; // No specific state mentioned
  }

  /**
   * Check if location mentions a US state
   */
  private containsUSState(location: string): boolean {
    const states = Object.keys(this.usStateBounds);
    const locationLower = location.toLowerCase();
    return states.some(state => locationLower.includes(state.toLowerCase()));
  }

  /**
   * Validate phone number format
   */
  private validatePhoneNumberFormat(phoneNumber: string): boolean {
    // Check for consistent US phone number format
    const patterns = [
      /^\(\d{3}\) \d{3}-\d{4}$/,           // (555) 123-4567
      /^\d{3}-\d{3}-\d{4}$/,               // 555-123-4567
      /^\d{3}\.\d{3}\.\d{4}$/,             // 555.123.4567
      /^\+1 \(\d{3}\) \d{3}-\d{4}$/,       // +1 (555) 123-4567
    ];

    return patterns.some(pattern => pattern.test(phoneNumber));
  }

  /**
   * Add custom architect information
   */
  addArchitectInfo(
    name: string,
    activePeriod: [number, number],
    notableWorks: string[]
  ): void {
    this.knownArchitects[name] = { activePeriod, notableWorks };
  }

  /**
   * Get known architects
   */
  getKnownArchitects(): Record<string, { activePeriod: [number, number]; notableWorks: string[] }> {
    return { ...this.knownArchitects };
  }
}

// Export singleton instance
export const consistencyValidator = new ConsistencyValidator();