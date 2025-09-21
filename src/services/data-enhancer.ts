import type {
  AutomatedCourseDetails,
  QualityCheckResult,
  DataEnhancement,
  EnhancementResult,
  QualityIssue,
} from '../types/quality.types';
import { apiLogger } from '../utils/logger';

/**
 * Automated data enhancement and improvement engine
 */
export class DataEnhancer {
  private readonly stateAbbreviations: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };

  // private readonly commonGolfTerms = [
    // 'golf course', 'country club', 'golf club', 'links', 'resort', 'municipal',
    // 'championship', 'executive', 'par 3', 'driving range'
  // ];

  /**
   * Enhance course data based on quality assessment
   */
  async enhanceData(
    data: AutomatedCourseDetails,
    qualityReport: QualityCheckResult
  ): Promise<EnhancementResult> {
    const enhancements: DataEnhancement[] = [];

    try {
      // Address missing critical fields
      for (const issue of qualityReport.issues.filter(i => i.severity === 'error')) {
        const enhancement = await this.attemptFieldEnhancement(data, issue);
        if (enhancement) enhancements.push(enhancement);
      }

      // Improve data formatting
      const formattingEnhancements = this.standardizeDataFormats(data);
      enhancements.push(...formattingEnhancements);

      // Generate derived fields
      const derivedEnhancements = this.generateDerivedFields(data);
      enhancements.push(...derivedEnhancements);

      // Enhance missing optional fields
      const optionalEnhancements = await this.enhanceOptionalFields(data);
      enhancements.push(...optionalEnhancements);

      const enhancedData = this.applyEnhancements(data, enhancements);
      const improvementScore = this.calculateImprovementScore(data, enhancedData);

      return {
        originalData: data,
        enhancements,
        enhancedData,
        improvementScore,
      };
    } catch (error) {
      apiLogger.error('Data enhancement failed', error);
      throw error;
    }
  }

  /**
   * Attempt to enhance a specific field based on quality issue
   */
  private async attemptFieldEnhancement(
    data: AutomatedCourseDetails,
    issue: QualityIssue
  ): Promise<DataEnhancement | null> {
    switch (issue.field) {
      case 'description':
        return this.generateDescription(data);
      case 'architect':
        return await this.lookupArchitect(data);
      case 'openingYear':
        return await this.estimateOpeningYear(data);
      case 'courseType':
        return this.inferCourseType(data);
      case 'numberOfHoles':
        return this.inferNumberOfHoles(data);
      case 'parScore':
        return this.calculateParScore(data);
      default:
        return null;
    }
  }

  /**
   * Generate basic description from available data
   */
  private generateDescription(data: AutomatedCourseDetails): DataEnhancement {
    const location = data.location || 'Unknown location';
    const architect = data.architect ? ` designed by ${data.architect}` : '';
    const year = data.openingYear ? ` (opened ${data.openingYear})` : '';
    const courseType = data.courseType ? ` ${data.courseType}` : '';
    const holes = data.numberOfHoles ? ` ${data.numberOfHoles}-hole` : '';

    const description = `${data.name} is a${holes}${courseType} golf course located in ${location}${architect}${year}.`;

    return {
      field: 'description',
      action: 'generate',
      originalValue: data.description,
      newValue: description,
      confidence: 0.7,
      source: 'generated',
    };
  }

  /**
   * Attempt to lookup architect information
   */
  private async lookupArchitect(data: AutomatedCourseDetails): Promise<DataEnhancement | null> {
    // This would integrate with external APIs in a real implementation
    // For now, we'll use pattern matching on course names
    const knownArchitectCourses: Record<string, string> = {
      'Pebble Beach': 'Jack Neville & Douglas Grant',
      'Augusta National': 'Alister MacKenzie & Bobby Jones',
      'Pinehurst No. 2': 'Donald Ross',
      'TPC Sawgrass': 'Pete Dye',
      'Bethpage Black': 'A.W. Tillinghast',
      'Winged Foot': 'A.W. Tillinghast',
    };

    for (const [courseName, architect] of Object.entries(knownArchitectCourses)) {
      if (data.name.toLowerCase().includes(courseName.toLowerCase())) {
        return {
          field: 'architect',
          action: 'generate',
          originalValue: data.architect,
          newValue: architect,
          confidence: 0.8,
          source: 'lookup',
        };
      }
    }

    return null;
  }

  /**
   * Estimate opening year based on architect and historical patterns
   */
  private async estimateOpeningYear(data: AutomatedCourseDetails): Promise<DataEnhancement | null> {
    if (!data.architect) return null;

    const architectPeriods: Record<string, [number, number]> = {
      'Donald Ross': [1900, 1940],
      'A.W. Tillinghast': [1910, 1940],
      'Alister MacKenzie': [1910, 1934],
      'Robert Trent Jones': [1940, 1980],
      'Pete Dye': [1960, 2000],
      'Jack Nicklaus': [1970, 2010],
    };

    for (const [architect, [start, end]] of Object.entries(architectPeriods)) {
      if (data.architect.includes(architect)) {
        const estimatedYear = Math.floor((start + end) / 2);
        return {
          field: 'openingYear',
          action: 'generate',
          originalValue: data.openingYear,
          newValue: estimatedYear,
          confidence: 0.5,
          source: 'estimated',
        };
      }
    }

    return null;
  }

  /**
   * Infer course type from name and characteristics
   */
  private inferCourseType(data: AutomatedCourseDetails): DataEnhancement | null {
    const name = data.name.toLowerCase();

    if (name.includes('country club') || name.includes('private')) {
      return {
        field: 'courseType',
        action: 'generate',
        originalValue: data.courseType,
        newValue: 'private',
        confidence: 0.8,
        source: 'inferred',
      };
    }

    if (name.includes('municipal') || name.includes('public')) {
      return {
        field: 'courseType',
        action: 'generate',
        originalValue: data.courseType,
        newValue: 'public',
        confidence: 0.8,
        source: 'inferred',
      };
    }

    if (name.includes('resort')) {
      return {
        field: 'courseType',
        action: 'generate',
        originalValue: data.courseType,
        newValue: 'resort',
        confidence: 0.7,
        source: 'inferred',
      };
    }

    if (name.includes('executive') || (data.totalYardage && data.totalYardage < 5000)) {
      return {
        field: 'courseType',
        action: 'generate',
        originalValue: data.courseType,
        newValue: 'executive',
        confidence: 0.6,
        source: 'inferred',
      };
    }

    return null;
  }

  /**
   * Infer number of holes from yardage and par
   */
  private inferNumberOfHoles(data: AutomatedCourseDetails): DataEnhancement | null {
    if (data.totalYardage) {
      if (data.totalYardage < 4000) {
        return {
          field: 'numberOfHoles',
          action: 'generate',
          originalValue: data.numberOfHoles,
          newValue: 9,
          confidence: 0.7,
          source: 'inferred',
        };
      } else if (data.totalYardage > 6000) {
        return {
          field: 'numberOfHoles',
          action: 'generate',
          originalValue: data.numberOfHoles,
          newValue: 18,
          confidence: 0.8,
          source: 'inferred',
        };
      }
    }

    if (data.parScore) {
      if (data.parScore <= 40) {
        return {
          field: 'numberOfHoles',
          action: 'generate',
          originalValue: data.numberOfHoles,
          newValue: 9,
          confidence: 0.8,
          source: 'inferred',
        };
      } else if (data.parScore >= 65) {
        return {
          field: 'numberOfHoles',
          action: 'generate',
          originalValue: data.numberOfHoles,
          newValue: 18,
          confidence: 0.8,
          source: 'inferred',
        };
      }
    }

    return null;
  }

  /**
   * Calculate par score from number of holes
   */
  private calculateParScore(data: AutomatedCourseDetails): DataEnhancement | null {
    if (!data.numberOfHoles) return null;

    let estimatedPar: number;
    if (data.numberOfHoles === 9) {
      estimatedPar = 36; // Typical 9-hole par
    } else if (data.numberOfHoles === 18) {
      estimatedPar = 72; // Typical 18-hole par
    } else if (data.numberOfHoles === 27) {
      estimatedPar = 108; // Typical 27-hole par
    } else {
      estimatedPar = data.numberOfHoles * 4; // Assume average par 4
    }

    return {
      field: 'parScore',
      action: 'generate',
      originalValue: data.parScore,
      newValue: estimatedPar,
      confidence: 0.6,
      source: 'calculated',
    };
  }

  /**
   * Standardize data formats
   */
  private standardizeDataFormats(data: AutomatedCourseDetails): DataEnhancement[] {
    const enhancements: DataEnhancement[] = [];

    // Standardize phone number format
    if (data.phoneNumber) {
      const standardized = this.standardizePhoneNumber(data.phoneNumber);
      if (standardized !== data.phoneNumber) {
        enhancements.push({
          field: 'phoneNumber',
          action: 'standardize',
          originalValue: data.phoneNumber,
          newValue: standardized,
          confidence: 0.9,
          source: 'formatting',
        });
      }
    }

    // Standardize location format
    if (data.location) {
      const standardized = this.standardizeLocation(data.location);
      if (standardized !== data.location) {
        enhancements.push({
          field: 'location',
          action: 'standardize',
          originalValue: data.location,
          newValue: standardized,
          confidence: 0.8,
          source: 'formatting',
        });
      }
    }

    // Standardize website URL
    if (data.website) {
      const standardized = this.standardizeWebsiteUrl(data.website);
      if (standardized !== data.website) {
        enhancements.push({
          field: 'website',
          action: 'standardize',
          originalValue: data.website,
          newValue: standardized,
          confidence: 0.9,
          source: 'formatting',
        });
      }
    }

    return enhancements;
  }

  /**
   * Generate derived fields
   */
  private generateDerivedFields(data: AutomatedCourseDetails): DataEnhancement[] {
    const enhancements: DataEnhancement[] = [];

    // Generate slug from name
    if (!data.id || data.id === data.name) {
      const slug = this.generateSlug(data.name);
      enhancements.push({
        field: 'id',
        action: 'generate',
        originalValue: data.id,
        newValue: slug,
        confidence: 0.9,
        source: 'derived',
      });
    }

    return enhancements;
  }

  /**
   * Enhance optional fields
   */
  private async enhanceOptionalFields(data: AutomatedCourseDetails): Promise<DataEnhancement[]> {
    const enhancements: DataEnhancement[] = [];

    // Infer public access from course type
    if (data.publicAccess === undefined && data.courseType) {
      const isPublic = ['public', 'municipal', 'resort'].includes(data.courseType);
      enhancements.push({
        field: 'publicAccess',
        action: 'generate',
        originalValue: data.publicAccess,
        newValue: isPublic,
        confidence: 0.7,
        source: 'inferred',
      });
    }

    return enhancements;
  }

  /**
   * Apply enhancements to data
   */
  private applyEnhancements(
    data: AutomatedCourseDetails,
    enhancements: DataEnhancement[]
  ): AutomatedCourseDetails {
    const enhanced = { ...data };

    for (const enhancement of enhancements) {
      if (enhancement.confidence >= 0.5) { // Only apply high-confidence enhancements
        (enhanced as any)[enhancement.field] = enhancement.newValue;
      }
    }

    return enhanced;
  }

  /**
   * Calculate improvement score
   */
  private calculateImprovementScore(
    original: AutomatedCourseDetails,
    enhanced: AutomatedCourseDetails
  ): number {
    const originalFields = this.countNonEmptyFields(original);
    const enhancedFields = this.countNonEmptyFields(enhanced);

    if (originalFields === 0) return 0;

    const improvement = ((enhancedFields - originalFields) / originalFields) * 100;
    return Math.max(0, Math.min(100, Math.round(improvement)));
  }

  /**
   * Count non-empty fields in data
   */
  private countNonEmptyFields(data: AutomatedCourseDetails): number {
    let count = 0;
    for (const [_key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined && value !== '' &&
          !(Array.isArray(value) && value.length === 0)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Standardize phone number format
   */
  private standardizePhoneNumber(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Handle US phone numbers
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    return phone; // Return original if not standard format
  }

  /**
   * Standardize location format
   */
  private standardizeLocation(location: string): string {
    let standardized = location.trim();

    // Expand state abbreviations
    for (const [fullName, abbrev] of Object.entries(this.stateAbbreviations)) {
      const pattern = new RegExp(`\\b${abbrev}\\b`, 'gi');
      if (pattern.test(standardized)) {
        standardized = standardized.replace(pattern, fullName);
      }
    }

    // Ensure consistent format: City, State, Country
    if (!standardized.includes('United States') && this.containsUSState(standardized)) {
      standardized += ', United States';
    }

    return standardized;
  }

  /**
   * Standardize website URL
   */
  private standardizeWebsiteUrl(url: string): string {
    let standardized = url.trim();

    // Add protocol if missing
    if (!standardized.startsWith('http://') && !standardized.startsWith('https://')) {
      standardized = 'https://' + standardized;
    }

    // Remove trailing slash
    if (standardized.endsWith('/')) {
      standardized = standardized.slice(0, -1);
    }

    return standardized;
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Check if location contains US state
   */
  private containsUSState(location: string): boolean {
    const states = Object.keys(this.stateAbbreviations);
    const locationLower = location.toLowerCase();
    return states.some(state => locationLower.includes(state.toLowerCase()));
  }
}

// Export singleton instance
export const dataEnhancer = new DataEnhancer();