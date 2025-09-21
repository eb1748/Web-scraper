import type {
  AutomatedCourseDetails,
  MissingFieldReport,
} from '../types/quality.types';
// import { apiLogger } from '../utils/logger';

/**
 * Completeness assessment with weighted field scoring
 */
export class CompletenessChecker {
  private readonly fieldWeights: Record<string, number> = {
    // Critical fields (high weight) - 10 points each
    name: 10,
    location: 10,
    latitude: 10,
    longitude: 10,

    // Important fields (medium weight) - 5 points each
    description: 5,
    website: 5,
    phoneNumber: 5,
    architect: 3,
    openingYear: 3,

    // Nice-to-have fields (low weight) - 1-3 points each
    totalYardage: 2,
    courseType: 2,
    heroImageUrl: 3,
    greensFeePriceRange: 2,
    numberOfHoles: 2,
    courseRating: 1,
    slopeRating: 1,
    parScore: 2,
    amenities: 1,
    emailContact: 1,
    teeTimeBookingUrl: 1,
    cartRequired: 1,
    dressCode: 1,
    publicAccess: 1,
    images: 2,
  };

  private readonly fieldPriorities: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    // Critical for basic functionality
    name: 'critical',
    location: 'critical',
    latitude: 'critical',
    longitude: 'critical',

    // High priority for user experience
    description: 'high',
    website: 'high',
    phoneNumber: 'high',
    heroImageUrl: 'high',
    architect: 'high',

    // Medium priority for golf-specific information
    openingYear: 'medium',
    totalYardage: 'medium',
    courseType: 'medium',
    parScore: 'medium',
    numberOfHoles: 'medium',
    greensFeePriceRange: 'medium',

    // Low priority for additional features
    courseRating: 'low',
    slopeRating: 'low',
    amenities: 'low',
    emailContact: 'low',
    teeTimeBookingUrl: 'low',
    cartRequired: 'low',
    dressCode: 'low',
    publicAccess: 'low',
    images: 'low',
  };

  private readonly fieldSuggestions: Record<string, string[]> = {
    name: [
      'Check official course website',
      'Search PGA Tour database',
      'Verify with local golf associations'
    ],
    description: [
      'Extract from course website about page',
      'Use Wikipedia summary if available',
      'Generate from available course details'
    ],
    architect: [
      'Search golf course architecture databases',
      'Check Wikipedia for historical information',
      'Consult PGA Tour course information'
    ],
    openingYear: [
      'Check course history on official website',
      'Search historical golf records',
      'Verify with local golf associations'
    ],
    website: [
      'Search for official course domain',
      'Check social media profiles for links',
      'Verify with golf directories'
    ],
    phoneNumber: [
      'Extract from course contact page',
      'Check Google My Business listing',
      'Verify with golf directories'
    ],
    latitude: [
      'Use geocoding service with course address',
      'Extract from Google Maps',
      'Check OpenStreetMap data'
    ],
    longitude: [
      'Use geocoding service with course address',
      'Extract from Google Maps',
      'Check OpenStreetMap data'
    ],
    heroImageUrl: [
      'Download from course website gallery',
      'Search high-quality stock photo sites',
      'Check official social media accounts'
    ],
    totalYardage: [
      'Check course scorecard',
      'Verify with PGA Tour data if applicable',
      'Extract from course information page'
    ],
    parScore: [
      'Calculate from scorecard information',
      'Check official course details',
      'Verify with golf course rating sites'
    ],
    greensFeePriceRange: [
      'Check course booking system',
      'Verify with golf pricing websites',
      'Extract from course rate sheets'
    ],
  };

  /**
   * Assess overall data completeness
   */
  assessCompleteness(data: AutomatedCourseDetails): number {
    let totalWeight = 0;
    let filledWeight = 0;

    for (const [field, weight] of Object.entries(this.fieldWeights)) {
      totalWeight += weight;

      const value = data[field as keyof AutomatedCourseDetails];
      if (this.isFieldComplete(value)) {
        filledWeight += weight;
      }
    }

    return Math.round((filledWeight / totalWeight) * 100);
  }

  /**
   * Assess completeness by category
   */
  assessCompletenessByCategory(data: AutomatedCourseDetails): Record<string, number> {
    const categories = {
      critical: ['name', 'location', 'latitude', 'longitude'],
      contact: ['website', 'phoneNumber', 'emailContact'],
      golfSpecific: ['architect', 'openingYear', 'totalYardage', 'parScore', 'numberOfHoles'],
      amenities: ['amenities', 'cartRequired', 'dressCode', 'publicAccess'],
      media: ['heroImageUrl', 'images'],
      pricing: ['greensFeePriceRange', 'teeTimeBookingUrl'],
    };

    const results: Record<string, number> = {};

    for (const [category, fields] of Object.entries(categories)) {
      let totalWeight = 0;
      let filledWeight = 0;

      for (const field of fields) {
        const weight = this.fieldWeights[field] || 1;
        totalWeight += weight;

        const value = data[field as keyof AutomatedCourseDetails];
        if (this.isFieldComplete(value)) {
          filledWeight += weight;
        }
      }

      results[category] = totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 100;
    }

    return results;
  }

  /**
   * Identify missing fields with priorities and suggestions
   */
  identifyMissingFields(data: AutomatedCourseDetails): MissingFieldReport[] {
    const missing: MissingFieldReport[] = [];

    for (const [field, _weight] of Object.entries(this.fieldWeights)) {
      const value = data[field as keyof AutomatedCourseDetails];
      if (!this.isFieldComplete(value)) {
        missing.push({
          field,
          priority: this.fieldPriorities[field] || 'low',
          suggestions: this.fieldSuggestions[field] || ['Manually collect this information'],
        });
      }
    }

    return missing.sort((a, b) => this.getPriorityValue(a.priority) - this.getPriorityValue(b.priority));
  }

  /**
   * Get critical missing fields that prevent publication
   */
  getCriticalMissingFields(data: AutomatedCourseDetails): string[] {
    const critical: string[] = [];

    for (const [field, priority] of Object.entries(this.fieldPriorities)) {
      if (priority === 'critical') {
        const value = data[field as keyof AutomatedCourseDetails];
        if (!this.isFieldComplete(value)) {
          critical.push(field);
        }
      }
    }

    return critical;
  }

  /**
   * Calculate completeness score for specific field categories
   */
  getRequiredFieldsCompleteness(data: AutomatedCourseDetails): number {
    const requiredFields = Object.entries(this.fieldPriorities)
      .filter(([_, priority]) => priority === 'critical' || priority === 'high')
      .map(([field, _]) => field);

    let totalWeight = 0;
    let filledWeight = 0;

    for (const field of requiredFields) {
      const weight = this.fieldWeights[field] || 1;
      totalWeight += weight;

      const value = data[field as keyof AutomatedCourseDetails];
      if (this.isFieldComplete(value)) {
        filledWeight += weight;
      }
    }

    return totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 100;
  }

  /**
   * Generate completeness improvement recommendations
   */
  generateImprovementRecommendations(data: AutomatedCourseDetails): string[] {
    const recommendations: string[] = [];
    const missing = this.identifyMissingFields(data);

    const criticalMissing = missing.filter(m => m.priority === 'critical');
    const highMissing = missing.filter(m => m.priority === 'high');

    if (criticalMissing.length > 0) {
      recommendations.push(
        `Complete ${criticalMissing.length} critical fields before publication: ${criticalMissing.map(m => m.field).join(', ')}`
      );
    }

    if (highMissing.length > 0) {
      recommendations.push(
        `Add ${highMissing.length} high-priority fields to improve user experience: ${highMissing.map(m => m.field).join(', ')}`
      );
    }

    // Specific recommendations based on data gaps
    if (!this.isFieldComplete(data.heroImageUrl) && !this.isFieldComplete(data.images)) {
      recommendations.push('Add high-quality course images to enhance visual appeal');
    }

    if (!this.isFieldComplete(data.architect) && !this.isFieldComplete(data.openingYear)) {
      recommendations.push('Research course history to add architect and opening year information');
    }

    if (!this.isFieldComplete(data.totalYardage) && !this.isFieldComplete(data.parScore)) {
      recommendations.push('Collect golf-specific metrics from course scorecard');
    }

    if (!this.isFieldComplete(data.greensFeePriceRange)) {
      recommendations.push('Add pricing information to help golfers plan their visit');
    }

    const overallCompleteness = this.assessCompleteness(data);
    if (overallCompleteness < 60) {
      recommendations.push('Consider prioritizing data collection - course completeness is below minimum threshold');
    }

    return recommendations;
  }

  /**
   * Check if a field is considered complete
   */
  private isFieldComplete(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'number' && isNaN(value)) return false;
    return true;
  }

  /**
   * Get numeric priority value for sorting
   */
  private getPriorityValue(priority: 'critical' | 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'medium': return 3;
      case 'low': return 4;
      default: return 5;
    }
  }

  /**
   * Set custom field weight
   */
  setFieldWeight(field: string, weight: number): void {
    (this.fieldWeights as any)[field] = weight;
  }

  /**
   * Set custom field priority
   */
  setFieldPriority(field: string, priority: 'critical' | 'high' | 'medium' | 'low'): void {
    this.fieldPriorities[field] = priority;
  }

  /**
   * Add custom field suggestions
   */
  addFieldSuggestions(field: string, suggestions: string[]): void {
    this.fieldSuggestions[field] = suggestions;
  }

  /**
   * Get field weights configuration
   */
  getFieldWeights(): Record<string, number> {
    return { ...this.fieldWeights };
  }

  /**
   * Get field priorities configuration
   */
  getFieldPriorities(): Record<string, 'critical' | 'high' | 'medium' | 'low'> {
    return { ...this.fieldPriorities };
  }
}

// Export singleton instance
export const completenessChecker = new CompletenessChecker();