import type {
  DataSource,
  DataConflict,
  CrossValidationResult,
  AutomatedCourseDetails,
} from '../types/quality.types';
// import { apiLogger } from '../utils/logger';

/**
 * Cross-validation system for multi-source data verification
 */
export class CrossValidator {
  private readonly sourceWeights: Record<string, number> = {
    'official': 1.0,
    'pga': 0.95,
    'golflink': 0.85,
    'golf.com': 0.80,
    'directory': 0.70,
    'community': 0.60,
    'user-generated': 0.50,
  };

  /**
   * Validate course data from multiple sources
   */
  async validateCourseData(sources: DataSource[]): Promise<CrossValidationResult> {
    if (sources.length === 0) {
      throw new Error('No data sources provided for cross-validation');
    }

    if (sources.length === 1) {
      return {
        consensus: sources[0].data,
        conflicts: [],
        reliability: sources[0].confidence,
        recommendedSource: sources[0],
        confidence: sources[0].confidence,
      };
    }

    const conflicts = this.identifyConflicts(sources);
    const consensus = this.buildConsensusData(sources);
    const reliability = this.assessSourceReliability(sources);

    return {
      consensus,
      conflicts,
      reliability,
      recommendedSource: this.selectBestSource(sources),
      confidence: this.calculateConfidence(conflicts, reliability),
    };
  }

  /**
   * Identify conflicts between data sources
   */
  private identifyConflicts(sources: DataSource[]): DataConflict[] {
    const conflicts: DataConflict[] = [];
    const fields = this.getCommonFields(sources);

    for (const field of fields) {
      const values = sources
        .map(s => ({ source: s, value: s.data[field as keyof AutomatedCourseDetails] }))
        .filter(v => v.value !== undefined && v.value !== null && v.value !== '');

      if (values.length < 2) continue; // Need at least 2 values to have a conflict

      const uniqueValues = this.getUniqueValues(values.map(v => v.value));

      if (uniqueValues.length > 1) {
        conflicts.push({
          field,
          values: uniqueValues,
          sources: values.map(v => v.source),
          severity: this.getConflictSeverity(field),
        });
      }
    }

    return conflicts;
  }

  /**
   * Build consensus data from multiple sources
   */
  private buildConsensusData(sources: DataSource[]): Partial<AutomatedCourseDetails> {
    const consensus: any = {};
    const fields = this.getCommonFields(sources);

    for (const field of fields) {
      const weightedValues = sources
        .filter(s => s.data[field as keyof AutomatedCourseDetails] !== undefined)
        .map(s => ({
          value: s.data[field as keyof AutomatedCourseDetails],
          weight: this.getSourceWeight(s.name) * s.confidence / 100,
        }));

      if (weightedValues.length > 0) {
        consensus[field] = this.selectConsensusValue(weightedValues, field);
      }
    }

    return consensus;
  }

  /**
   * Select the best consensus value for a field
   */
  private selectConsensusValue(
    weightedValues: Array<{ value: any; weight: number }>,
    field: string
  ): any {
    // Sort by weight (highest first)
    weightedValues.sort((a, b) => b.weight - a.weight);

    // For string values, use highest confidence source
    if (typeof weightedValues[0]?.value === 'string') {
      return weightedValues[0].value;
    }

    // For numeric values, use weighted average if reasonable
    if (typeof weightedValues[0]?.value === 'number') {
      return this.calculateWeightedAverage(weightedValues, field);
    }

    // For arrays, merge unique values from top sources
    if (Array.isArray(weightedValues[0]?.value)) {
      return this.mergeArrayValues(weightedValues);
    }

    // For booleans, use highest confidence source
    if (typeof weightedValues[0]?.value === 'boolean') {
      return weightedValues[0].value;
    }

    // Default: highest confidence
    return weightedValues[0].value;
  }

  /**
   * Calculate weighted average for numeric fields
   */
  private calculateWeightedAverage(
    weightedValues: Array<{ value: number; weight: number }>,
    field: string
  ): number {
    // For some fields, weighted average doesn't make sense
    const noAverageFields = ['openingYear', 'numberOfHoles', 'parScore'];
    if (noAverageFields.includes(field)) {
      return weightedValues[0].value; // Use highest confidence source
    }

    const totalWeight = weightedValues.reduce((sum, wv) => sum + wv.weight, 0);
    const weightedSum = weightedValues.reduce((sum, wv) => sum + wv.value * wv.weight, 0);

    return Math.round(weightedSum / totalWeight * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Merge array values from multiple sources
   */
  private mergeArrayValues(weightedValues: Array<{ value: any[]; weight: number }>): any[] {
    const allValues = weightedValues.flatMap(wv => wv.value);
    return [...new Set(allValues)]; // Remove duplicates
  }

  /**
   * Assess overall source reliability
   */
  private assessSourceReliability(sources: DataSource[]): number {
    if (sources.length === 0) return 0;

    const weightedReliability = sources.reduce((sum, source) => {
      const sourceWeight = this.getSourceWeight(source.name);
      return sum + (source.confidence * sourceWeight);
    }, 0);

    const totalWeight = sources.reduce((sum, source) => {
      return sum + this.getSourceWeight(source.name);
    }, 0);

    return Math.round(weightedReliability / totalWeight);
  }

  /**
   * Select the best source based on reliability and completeness
   */
  private selectBestSource(sources: DataSource[]): DataSource {
    return sources.reduce((best, current) => {
      const currentScore = this.calculateSourceScore(current);
      const bestScore = this.calculateSourceScore(best);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(conflicts: DataConflict[], reliability: number): number {
    // Start with base reliability
    let confidence = reliability;

    // Reduce confidence based on conflicts
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high').length;
    const mediumSeverityConflicts = conflicts.filter(c => c.severity === 'medium').length;

    confidence -= highSeverityConflicts * 15;
    confidence -= mediumSeverityConflicts * 8;
    confidence -= conflicts.length * 2; // General penalty for any conflicts

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Get all common fields across sources
   */
  private getCommonFields(sources: DataSource[]): string[] {
    const allFields = new Set<string>();

    sources.forEach(source => {
      Object.keys(source.data).forEach(field => allFields.add(field));
    });

    return Array.from(allFields);
  }

  /**
   * Get unique values considering similarity for strings
   */
  private getUniqueValues(values: any[]): any[] {
    if (values.length === 0) return [];

    const unique: any[] = [values[0]];

    for (let i = 1; i < values.length; i++) {
      const value = values[i];
      let isUnique = true;

      for (const existingValue of unique) {
        if (this.areValuesSimilar(value, existingValue)) {
          isUnique = false;
          break;
        }
      }

      if (isUnique) {
        unique.push(value);
      }
    }

    return unique;
  }

  /**
   * Check if two values are similar enough to be considered the same
   */
  private areValuesSimilar(value1: any, value2: any): boolean {
    // Exact match
    if (value1 === value2) return true;

    // Both null/undefined
    if ((value1 == null) && (value2 == null)) return true;

    // Different types
    if (typeof value1 !== typeof value2) return false;

    // Numeric values with small differences
    if (typeof value1 === 'number' && typeof value2 === 'number') {
      const difference = Math.abs(value1 - value2);
      const average = (value1 + value2) / 2;
      return difference / average < 0.05; // 5% tolerance
    }

    // String similarity
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      return this.calculateStringSimilarity(value1, value2) > 0.85;
    }

    return false;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get weight for a data source
   */
  private getSourceWeight(sourceName: string): number {
    const lowerSource = sourceName.toLowerCase();

    for (const [key, weight] of Object.entries(this.sourceWeights)) {
      if (lowerSource.includes(key)) {
        return weight;
      }
    }

    return 0.5; // Default weight for unknown sources
  }

  /**
   * Get conflict severity based on field importance
   */
  private getConflictSeverity(field: string): 'high' | 'medium' | 'low' {
    const highImportanceFields = ['name', 'latitude', 'longitude', 'website'];
    const mediumImportanceFields = ['architect', 'openingYear', 'totalYardage', 'parScore'];

    if (highImportanceFields.includes(field)) return 'high';
    if (mediumImportanceFields.includes(field)) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall score for a source
   */
  private calculateSourceScore(source: DataSource): number {
    const baseScore = source.confidence;
    const sourceWeight = this.getSourceWeight(source.name);
    const recencyBonus = this.calculateRecencyBonus(source.timestamp);

    return (baseScore * sourceWeight) + recencyBonus;
  }

  /**
   * Calculate bonus points for recent data
   */
  private calculateRecencyBonus(timestamp: Date): number {
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    const daysSinceUpdate = hoursSinceUpdate / 24;

    if (daysSinceUpdate <= 1) return 10;
    if (daysSinceUpdate <= 7) return 5;
    if (daysSinceUpdate <= 30) return 2;
    return 0;
  }
}

// Export singleton instance
export const crossValidator = new CrossValidator();