# PR 5: Data Quality and Validation System

*Comprehensive data validation, quality scoring, and automated quality assurance*

## 🎯 **Objective**

Implement a robust data quality and validation system to ensure accuracy, completeness, and reliability of all collected golf course data.

## 🔍 **Data Quality Framework**

### **Quality Metrics and Scoring**

```typescript
// src/services/quality-assessor.ts
interface QualityMetrics {
  completeness: number;      // 0-100% - Required fields populated
  accuracy: number;          // 0-100% - Cross-validation score
  consistency: number;       // 0-100% - Internal consistency checks
  freshness: number;         // 0-100% - Data age and update frequency
  reliability: number;       // 0-100% - Source trustworthiness
  overallScore: number;      // Weighted average of all metrics
}

interface QualityCheckResult {
  courseId: string;
  metrics: QualityMetrics;
  issues: QualityIssue[];
  recommendations: string[];
  manualReviewRequired: boolean;
  confidenceLevel: 'high' | 'medium' | 'low';
  lastValidated: Date;
}

class DataQualityAssessor {
  private requiredFields = [
    'name', 'location', 'latitude', 'longitude',
    'description', 'website', 'phoneNumber'
  ];

  private importantFields = [
    'architect', 'openingYear', 'courseType',
    'totalYardage', 'parScore', 'heroImageUrl'
  ];

  async assessCourseData(courseData: AutomatedCourseDetails): Promise<QualityCheckResult> {
    const metrics = await this.calculateMetrics(courseData);
    const issues = this.identifyIssues(courseData, metrics);
    const recommendations = this.generateRecommendations(issues);

    return {
      courseId: courseData.id,
      metrics,
      issues,
      recommendations,
      manualReviewRequired: metrics.overallScore < 70,
      confidenceLevel: this.getConfidenceLevel(metrics.overallScore),
      lastValidated: new Date(),
    };
  }

  private async calculateMetrics(data: AutomatedCourseDetails): Promise<QualityMetrics> {
    const completeness = this.assessCompleteness(data);
    const accuracy = await this.assessAccuracy(data);
    const consistency = this.assessConsistency(data);
    const freshness = this.assessFreshness(data);
    const reliability = this.assessReliability(data);

    // Weighted scoring: completeness 30%, accuracy 25%, consistency 20%, reliability 15%, freshness 10%
    const overallScore = (
      completeness * 0.30 +
      accuracy * 0.25 +
      consistency * 0.20 +
      reliability * 0.15 +
      freshness * 0.10
    );

    return {
      completeness,
      accuracy,
      consistency,
      freshness,
      reliability,
      overallScore: Math.round(overallScore),
    };
  }
}
```

### **Field-Level Validation**

```typescript
// src/validators/field-validators.ts
interface ValidationRule {
  field: string;
  rules: Array<{
    type: 'required' | 'format' | 'range' | 'pattern' | 'cross_reference';
    params: any;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

class FieldValidator {
  private validationRules: ValidationRule[] = [
    {
      field: 'name',
      rules: [
        { type: 'required', params: {}, message: 'Course name is required', severity: 'error' },
        { type: 'pattern', params: { regex: /^[a-zA-Z0-9\s\-&']+$/ }, message: 'Invalid characters in course name', severity: 'warning' },
      ],
    },
    {
      field: 'latitude',
      rules: [
        { type: 'required', params: {}, message: 'Latitude is required', severity: 'error' },
        { type: 'range', params: { min: -90, max: 90 }, message: 'Latitude must be between -90 and 90', severity: 'error' },
      ],
    },
    {
      field: 'phoneNumber',
      rules: [
        { type: 'pattern', params: { regex: /^\+?[\d\s\-\(\)]+$/ }, message: 'Invalid phone number format', severity: 'warning' },
      ],
    },
    {
      field: 'openingYear',
      rules: [
        { type: 'range', params: { min: 1700, max: new Date().getFullYear() }, message: 'Invalid opening year', severity: 'warning' },
      ],
    },
  ];

  async validateField(fieldName: string, value: any, context: any): Promise<ValidationResult[]> {
    const rule = this.validationRules.find(r => r.field === fieldName);
    if (!rule) return [];

    const results: ValidationResult[] = [];

    for (const validation of rule.rules) {
      const result = await this.applyValidation(fieldName, value, validation, context);
      if (result) results.push(result);
    }

    return results;
  }

  private async applyValidation(field: string, value: any, rule: any, context: any): Promise<ValidationResult | null> {
    switch (rule.type) {
      case 'required':
        return this.validateRequired(field, value, rule);
      case 'format':
        return this.validateFormat(field, value, rule);
      case 'range':
        return this.validateRange(field, value, rule);
      case 'pattern':
        return this.validatePattern(field, value, rule);
      case 'cross_reference':
        return await this.validateCrossReference(field, value, rule, context);
      default:
        return null;
    }
  }
}
```

## 🔄 **Cross-Validation System**

### **Multi-Source Data Verification**

```typescript
// src/services/cross-validator.ts
interface DataSource {
  name: string;
  confidence: number;
  data: Partial<AutomatedCourseDetails>;
  timestamp: Date;
}

class CrossValidator {
  async validateCourseData(sources: DataSource[]): Promise<CrossValidationResult> {
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

  private identifyConflicts(sources: DataSource[]): DataConflict[] {
    const conflicts: DataConflict[] = [];
    const fields = this.getCommonFields(sources);

    for (const field of fields) {
      const values = sources.map(s => s.data[field]).filter(v => v !== undefined);
      const uniqueValues = [...new Set(values)];

      if (uniqueValues.length > 1) {
        conflicts.push({
          field,
          values: uniqueValues,
          sources: sources.filter(s => s.data[field] !== undefined),
          severity: this.getConflictSeverity(field),
        });
      }
    }

    return conflicts;
  }

  private buildConsensusData(sources: DataSource[]): Partial<AutomatedCourseDetails> {
    const consensus: any = {};
    const fields = this.getCommonFields(sources);

    for (const field of fields) {
      const weightedValues = sources
        .filter(s => s.data[field] !== undefined)
        .map(s => ({ value: s.data[field], weight: s.confidence }));

      consensus[field] = this.selectConsensusValue(weightedValues);
    }

    return consensus;
  }

  private selectConsensusValue(weightedValues: Array<{ value: any; weight: number }>): any {
    // For string values, use highest confidence source
    if (typeof weightedValues[0]?.value === 'string') {
      return weightedValues.sort((a, b) => b.weight - a.weight)[0].value;
    }

    // For numeric values, use weighted average
    if (typeof weightedValues[0]?.value === 'number') {
      const totalWeight = weightedValues.reduce((sum, wv) => sum + wv.weight, 0);
      const weightedSum = weightedValues.reduce((sum, wv) => sum + wv.value * wv.weight, 0);
      return Math.round(weightedSum / totalWeight);
    }

    // Default: highest confidence
    return weightedValues.sort((a, b) => b.weight - a.weight)[0].value;
  }
}
```

## 📊 **Automated Quality Checks**

### **Completeness Assessment**

```typescript
// src/services/completeness-checker.ts
class CompletenessChecker {
  private fieldWeights = {
    // Critical fields (high weight)
    name: 10,
    location: 10,
    latitude: 10,
    longitude: 10,

    // Important fields (medium weight)
    description: 5,
    website: 5,
    phoneNumber: 5,
    architect: 3,
    openingYear: 3,

    // Nice-to-have fields (low weight)
    totalYardage: 1,
    courseType: 2,
    heroImageUrl: 3,
    greensFeePriceRange: 2,
  };

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

  private isFieldComplete(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }

  identifyMissingFields(data: AutomatedCourseDetails): MissingFieldReport[] {
    const missing: MissingFieldReport[] = [];

    for (const [field, weight] of Object.entries(this.fieldWeights)) {
      const value = data[field as keyof AutomatedCourseDetails];
      if (!this.isFieldComplete(value)) {
        missing.push({
          field,
          priority: this.getPriority(weight),
          suggestions: this.getSuggestions(field),
        });
      }
    }

    return missing.sort((a, b) => this.getPriorityValue(a.priority) - this.getPriorityValue(b.priority));
  }
}
```

### **Consistency Validation**

```typescript
// src/services/consistency-validator.ts
class ConsistencyValidator {
  validateInternalConsistency(data: AutomatedCourseDetails): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Location consistency
    if (data.latitude && data.longitude && data.location) {
      const locationConsistency = this.validateLocationConsistency(
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

    // Golf course data consistency
    if (data.totalYardage && data.numberOfHoles) {
      const avgYardagePerHole = data.totalYardage / data.numberOfHoles;
      if (avgYardagePerHole < 200 || avgYardagePerHole > 600) {
        issues.push({
          type: 'yardage_inconsistency',
          severity: 'warning',
          message: `Average yardage per hole (${avgYardagePerHole}) seems unusual`,
          affectedFields: ['totalYardage', 'numberOfHoles'],
        });
      }
    }

    // Opening year consistency
    if (data.openingYear && data.architect) {
      const architectConsistency = this.validateArchitectPeriod(data.openingYear, data.architect);
      if (!architectConsistency.isPlausible) {
        issues.push({
          type: 'historical_inconsistency',
          severity: 'info',
          message: `Opening year may not align with architect's known active period`,
          affectedFields: ['openingYear', 'architect'],
        });
      }
    }

    return issues;
  }

  private validateLocationConsistency(lat: number, lon: number, location: string): { isConsistent: boolean; confidence: number } {
    // Use reverse geocoding to validate coordinates match location
    // This would integrate with free geocoding services
    return { isConsistent: true, confidence: 0.8 };
  }
}
```

## 🔧 **Quality Improvement Engine**

### **Automated Data Enhancement**

```typescript
// src/services/data-enhancer.ts
class DataEnhancer {
  async enhanceData(data: AutomatedCourseDetails, qualityReport: QualityCheckResult): Promise<EnhancementResult> {
    const enhancements: DataEnhancement[] = [];

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

    return {
      originalData: data,
      enhancements,
      enhancedData: this.applyEnhancements(data, enhancements),
      improvementScore: this.calculateImprovement(qualityReport, enhancements),
    };
  }

  private async attemptFieldEnhancement(data: AutomatedCourseDetails, issue: QualityIssue): Promise<DataEnhancement | null> {
    switch (issue.field) {
      case 'description':
        return this.generateDescription(data);
      case 'architect':
        return await this.lookupArchitect(data);
      case 'openingYear':
        return await this.lookupOpeningYear(data);
      default:
        return null;
    }
  }

  private generateDescription(data: AutomatedCourseDetails): DataEnhancement {
    // Generate basic description from available data
    const location = data.location || 'Unknown location';
    const architect = data.architect ? ` designed by ${data.architect}` : '';
    const year = data.openingYear ? ` (opened ${data.openingYear})` : '';

    return {
      field: 'description',
      action: 'generate',
      originalValue: data.description,
      newValue: `${data.name} is a golf course located in ${location}${architect}${year}.`,
      confidence: 0.6,
      source: 'generated',
    };
  }
}
```

## 📋 **Quality Monitoring Dashboard**

### **Quality Metrics Tracking**

```typescript
// src/services/quality-monitor.ts
interface QualityTrend {
  date: Date;
  overallScore: number;
  completeness: number;
  accuracy: number;
  coursesValidated: number;
  issuesFound: number;
  issuesResolved: number;
}

class QualityMonitor {
  async generateQualityReport(timeframe: 'daily' | 'weekly' | 'monthly'): Promise<QualityReport> {
    const trends = await this.getQualityTrends(timeframe);
    const topIssues = await this.getTopQualityIssues();
    const sourceReliability = await this.analyzeSourceReliability();

    return {
      summary: {
        totalCourses: await this.getTotalCourses(),
        averageQualityScore: this.calculateAverageScore(trends),
        coursesNeedingReview: await this.getCoursesNeedingReview(),
        recentlyUpdated: await this.getRecentlyUpdated(),
      },
      trends,
      topIssues,
      sourceReliability,
      recommendations: this.generateRecommendations(trends, topIssues),
    };
  }

  private generateRecommendations(trends: QualityTrend[], issues: QualityIssue[]): string[] {
    const recommendations: string[] = [];

    // Trend-based recommendations
    const latestTrend = trends[trends.length - 1];
    const previousTrend = trends[trends.length - 2];

    if (latestTrend && previousTrend && latestTrend.overallScore < previousTrend.overallScore) {
      recommendations.push('Quality scores are declining. Review data collection processes.');
    }

    // Issue-based recommendations
    const commonIssues = this.groupIssuesByType(issues);
    for (const [issueType, count] of Object.entries(commonIssues)) {
      if (count > 10) {
        recommendations.push(`Address ${issueType} issues affecting ${count} courses.`);
      }
    }

    return recommendations;
  }
}
```

## 📋 **Acceptance Criteria**

- [ ] Comprehensive data quality scoring system implemented
- [ ] Field-level validation with customizable rules
- [ ] Cross-validation system for multi-source data
- [ ] Automated consistency checking
- [ ] Data enhancement and improvement engine
- [ ] Quality monitoring and trend tracking
- [ ] Automated issue identification and prioritization
- [ ] Quality report generation system
- [ ] Manual review flagging for low-quality data
- [ ] Source reliability assessment

## 🔍 **Testing Requirements**

- Quality scoring algorithm validation tests
- Cross-validation accuracy tests
- Consistency checking tests
- Data enhancement functionality tests
- Quality monitoring system tests

## 📚 **Dependencies**

```bash
# Validation and quality tools
npm install joi zod validator
npm install lodash date-fns
npm install fast-levenshtein string-similarity
```

## 🚀 **Expected Outcomes**

- 95%+ data quality scores across all course records
- Automated identification and resolution of data issues
- Reliable cross-validation of data from multiple sources
- Comprehensive quality monitoring and reporting
- Reduced manual data review requirements
- Consistent, high-quality data for all 100+ golf courses
- Scalable quality assurance system for ongoing maintenance

This PR establishes a robust foundation for maintaining high data quality standards throughout the automated collection and enhancement process.