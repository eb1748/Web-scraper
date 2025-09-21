#!/usr/bin/env node

/**
 * Quality System Demo Script
 * Demonstrates the usage of the comprehensive data quality and validation system
 */

import { qualitySystem } from '../services/quality-system';
import type { AutomatedCourseDetails, DataSource } from '../types/quality.types';
import { apiLogger } from '../utils/logger';

// Sample course data for demonstration
const sampleCourses: AutomatedCourseDetails[] = [
  {
    id: 'pebble-beach',
    name: 'Pebble Beach Golf Links',
    description: 'Iconic oceanside golf course in Monterey, California',
    location: 'Pebble Beach, California, United States',
    latitude: 36.5693,
    longitude: -121.9472,
    architect: 'Jack Neville & Douglas Grant',
    openingYear: 1919,
    courseType: 'resort',
    totalYardage: 6828,
    courseRating: 74.5,
    slopeRating: 144,
    parScore: 72,
    numberOfHoles: 18,
    website: 'https://www.pebblebeach.com',
    phoneNumber: '(831) 624-3811',
    emailContact: 'info@pebblebeach.com',
    heroImageUrl: 'https://example.com/pebble-beach-hero.jpg',
    greensFeePriceRange: '$575-$595',
    cartRequired: false,
    publicAccess: true,
    images: ['image1.jpg', 'image2.jpg'],
    amenities: ['Pro Shop', 'Restaurant', 'Driving Range'],
    confidence: 95,
    source: 'official',
    extractedAt: new Date(),
  },
  {
    id: 'incomplete-course',
    name: 'Test Golf Course',
    location: 'Somewhere, USA',
    phoneNumber: '5551234567', // Unformatted
    website: 'testgolf.com', // Missing protocol
    confidence: 60,
    source: 'directory',
    extractedAt: new Date(),
  },
  {
    id: 'problematic-course',
    name: 'Bad Data Golf Course',
    description: 'A course with some data issues',
    location: 'Phoenix, Arizona, United States',
    latitude: 33.4484, // Phoenix coordinates
    longitude: -112.0740,
    architect: 'Donald Ross', // Inconsistent with location/era
    openingYear: 2010, // Recent, but architect died in 1948
    totalYardage: 1000, // Too short
    numberOfHoles: 18,
    parScore: 50, // Too low for 18 holes
    website: 'not-a-valid-url',
    phoneNumber: 'invalid-phone',
    confidence: 45,
    source: 'community',
    extractedAt: new Date(),
  },
];

async function demonstrateQualitySystem(): Promise<void> {
  console.log('🏌️  Golf Course Data Quality System Demo\n');

  try {
    // 1. Basic Quality Assessment
    console.log('📊 1. Basic Quality Assessment');
    console.log('=' .repeat(50));

    for (const course of sampleCourses) {
      console.log(`\nAssessing: ${course.name}`);
      const assessment = await qualitySystem.assessQuality(course);

      console.log(`  Overall Score: ${assessment.metrics.overallScore}/100`);
      console.log(`  Completeness: ${assessment.metrics.completeness}%`);
      console.log(`  Accuracy: ${assessment.metrics.accuracy}%`);
      console.log(`  Consistency: ${assessment.metrics.consistency}%`);
      console.log(`  Confidence Level: ${assessment.confidenceLevel}`);
      console.log(`  Manual Review Required: ${assessment.manualReviewRequired}`);
      console.log(`  Issues Found: ${assessment.issues.length}`);

      if (assessment.issues.length > 0) {
        console.log('  Top Issues:');
        assessment.issues.slice(0, 3).forEach(issue => {
          console.log(`    - ${issue.severity.toUpperCase()}: ${issue.message}`);
        });
      }

      if (assessment.recommendations.length > 0) {
        console.log('  Recommendations:');
        assessment.recommendations.slice(0, 2).forEach(rec => {
          console.log(`    - ${rec}`);
        });
      }
    }

    // 2. Field Validation
    console.log('\n\n🔍 2. Field Validation');
    console.log('=' .repeat(50));

    const fieldResults = await qualitySystem.validateFields(sampleCourses[2]); // Use problematic course
    console.log(`\nValidating fields for: ${sampleCourses[2].name}`);

    fieldResults.forEach(result => {
      if (!result.valid || result.warnings.length > 0) {
        console.log(`  ${result.field}:`);
        if (result.errors.length > 0) {
          console.log(`    Errors: ${result.errors.join(', ')}`);
        }
        if (result.warnings.length > 0) {
          console.log(`    Warnings: ${result.warnings.join(', ')}`);
        }
      }
    });

    // 3. Completeness Check
    console.log('\n\n📋 3. Completeness Assessment');
    console.log('=' .repeat(50));

    const completeness = qualitySystem.checkCompleteness(sampleCourses[1]); // Use incomplete course
    console.log(`\nCompleteness for: ${sampleCourses[1].name}`);
    console.log(`  Overall: ${completeness.overall}%`);
    console.log('  By Category:');
    Object.entries(completeness.categories).forEach(([category, score]) => {
      console.log(`    ${category}: ${score}%`);
    });

    console.log('  Missing Critical Fields:');
    completeness.missing
      .filter(m => m.priority === 'critical')
      .forEach(missing => {
        console.log(`    - ${missing.field} (${missing.priority})`);
      });

    // 4. Consistency Check
    console.log('\n\n⚖️  4. Consistency Validation');
    console.log('=' .repeat(50));

    const consistencyIssues = qualitySystem.checkConsistency(sampleCourses[2]); // Use problematic course
    console.log(`\nConsistency issues for: ${sampleCourses[2].name}`);

    if (consistencyIssues.length > 0) {
      consistencyIssues.forEach(issue => {
        console.log(`  ${issue.severity.toUpperCase()}: ${issue.message}`);
        console.log(`    Affected fields: ${issue.affectedFields.join(', ')}`);
      });
    } else {
      console.log('  No consistency issues found.');
    }

    // 5. Data Enhancement
    console.log('\n\n🚀 5. Data Enhancement');
    console.log('=' .repeat(50));

    const enhancement = await qualitySystem.enhanceData(sampleCourses[1]); // Use incomplete course
    console.log(`\nEnhancing: ${sampleCourses[1].name}`);
    console.log(`  Enhancements Applied: ${enhancement.enhancements.length}`);
    console.log(`  Improvement Score: ${enhancement.improvementScore}%`);

    if (enhancement.enhancements.length > 0) {
      console.log('  Enhancements:');
      enhancement.enhancements.forEach(enh => {
        console.log(`    - ${enh.field}: ${enh.action} (confidence: ${enh.confidence})`);
        if (enh.action === 'generate' && typeof enh.newValue === 'string' && enh.newValue.length < 100) {
          console.log(`      New value: "${enh.newValue}"`);
        }
      });
    }

    // 6. Cross-Validation
    console.log('\n\n🔄 6. Cross-Validation');
    console.log('=' .repeat(50));

    const sources: DataSource[] = [
      {
        name: 'official',
        confidence: 95,
        data: sampleCourses[0],
        timestamp: new Date(),
      },
      {
        name: 'directory',
        confidence: 75,
        data: {
          ...sampleCourses[0],
          totalYardage: 6800, // Slight difference
          architect: 'Jack Neville', // Missing co-architect
        },
        timestamp: new Date(),
      },
    ];

    const crossValidation = await qualitySystem.crossValidate(sources);
    console.log('\nCross-validation results:');
    console.log(`  Conflicts Found: ${crossValidation.conflicts.length}`);
    console.log(`  Overall Confidence: ${crossValidation.confidence}%`);
    console.log(`  Recommended Source: ${crossValidation.recommendedSource.name}`);

    if (crossValidation.conflicts.length > 0) {
      console.log('  Conflicts:');
      crossValidation.conflicts.forEach(conflict => {
        console.log(`    - ${conflict.field}: ${conflict.values.join(' vs ')}`);
      });
    }

    // 7. Batch Processing
    console.log('\n\n📦 7. Batch Processing');
    console.log('=' .repeat(50));

    const batchResults = await qualitySystem.batchProcess(sampleCourses, {
      enhanceData: true,
      maxConcurrent: 2,
    });

    console.log('\nBatch Processing Summary:');
    console.log(`  Total Courses: ${batchResults.summary.total}`);
    console.log(`  Successful: ${batchResults.summary.successful}`);
    console.log(`  Failed: ${batchResults.summary.failed}`);
    console.log(`  Average Score: ${batchResults.summary.averageScore}/100`);
    console.log(`  Courses Needing Review: ${batchResults.summary.coursesNeedingReview}`);

    // 8. Quality Monitoring & Reporting
    console.log('\n\n📈 8. Quality Monitoring');
    console.log('=' .repeat(50));

    const statistics = qualitySystem.getStatistics();
    console.log('\nCurrent Statistics:');
    console.log(`  Total Assessments: ${statistics.assessments}`);
    console.log(`  Average Score: ${statistics.averageScore}/100`);
    console.log(`  Courses Assessed: ${statistics.coursesAssessed}`);
    console.log(`  Recent Activity: ${statistics.recentActivity}`);

    const report = await qualitySystem.generateReport('daily');
    console.log('\nQuality Report Summary:');
    console.log(`  Total Courses: ${report.summary.totalCourses}`);
    console.log(`  Average Quality Score: ${report.summary.averageQualityScore}/100`);
    console.log(`  Courses Needing Review: ${report.summary.coursesNeedingReview}`);
    console.log(`  Recently Updated: ${report.summary.recentlyUpdated}`);

    if (report.recommendations.length > 0) {
      console.log('  Top Recommendations:');
      report.recommendations.slice(0, 3).forEach(rec => {
        console.log(`    - ${rec}`);
      });
    }

    // 9. Configuration Example
    console.log('\n\n⚙️  9. System Configuration');
    console.log('=' .repeat(50));

    // Add custom validation rule
    qualitySystem.addValidationRule({
      field: 'customField',
      rules: [{
        type: 'required',
        params: {},
        message: 'Custom field is required',
        severity: 'warning',
      }],
    });

    // Configure field weights
    qualitySystem.configureFieldWeight('heroImageUrl', 5); // Increase importance
    qualitySystem.configureFieldPriority('amenities', 'high'); // Increase priority

    console.log('✅ Custom validation rule added');
    console.log('✅ Field weights configured');
    console.log('✅ Field priorities updated');

    console.log('\n\n🎉 Demo completed successfully!');
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('❌ Demo failed:', error);
    apiLogger.error('Quality system demo failed', error);
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  demonstrateQualitySystem()
    .then(() => {
      console.log('\n✨ Quality system demo finished. Check the logs for detailed information.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { demonstrateQualitySystem };