#!/usr/bin/env node

/**
 * Structured Data Validation Script
 *
 * Validates generated structured data against Schema.org standards and Google guidelines.
 * Checks for completeness, accuracy, and compliance with rich snippets requirements.
 */

import { generateStructuredData } from '../services/seo/structured-data-generator';
import type { AutomatedCourseDetails } from '../types/quality.types';
import logger from '../utils/logger';

interface ValidationResult {
  isValid: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

interface SchemaOrgRequirement {
  property: string;
  required: boolean;
  type?: string;
  description: string;
}

/**
 * Schema.org requirements for GolfCourse type
 */
const GOLF_COURSE_REQUIREMENTS: SchemaOrgRequirement[] = [
  { property: '@context', required: true, type: 'string', description: 'Must be "https://schema.org"' },
  { property: '@type', required: true, type: 'string', description: 'Must be "GolfCourse"' },
  { property: 'name', required: true, type: 'string', description: 'Name of the golf course' },
  { property: 'address', required: true, type: 'object', description: 'PostalAddress object' },
  { property: 'geo', required: true, type: 'object', description: 'GeoCoordinates object' },
  { property: 'description', required: false, type: 'string', description: 'Course description' },
  { property: 'url', required: false, type: 'string', description: 'Course website URL' },
  { property: 'telephone', required: false, type: 'string', description: 'Contact phone number' },
  { property: 'priceRange', required: false, type: 'string', description: 'Pricing information' },
  { property: 'aggregateRating', required: false, type: 'object', description: 'AggregateRating object' },
  { property: 'amenityFeature', required: false, type: 'array', description: 'Array of LocationFeatureSpecification' }
];

/**
 * Validate structured data against Schema.org requirements
 */
function validateSchemaOrgCompliance(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check basic structure
  if (!data || typeof data !== 'object') {
    errors.push('Structured data must be a valid object');
    return { isValid: false, score: 0, errors, warnings, recommendations };
  }

  // Validate each requirement
  GOLF_COURSE_REQUIREMENTS.forEach(requirement => {
    const value = data[requirement.property];

    if (requirement.required && !value) {
      errors.push(`Missing required property: ${requirement.property}`);
      score -= 20;
    } else if (!requirement.required && !value) {
      warnings.push(`Missing optional property: ${requirement.property} - ${requirement.description}`);
      score -= 5;
    } else if (value) {
      // Type validation
      if (requirement.type === 'string' && typeof value !== 'string') {
        errors.push(`Property ${requirement.property} must be a string`);
        score -= 10;
      } else if (requirement.type === 'object' && typeof value !== 'object') {
        errors.push(`Property ${requirement.property} must be an object`);
        score -= 10;
      } else if (requirement.type === 'array' && !Array.isArray(value)) {
        errors.push(`Property ${requirement.property} must be an array`);
        score -= 10;
      }
    }
  });

  // Specific validations
  if (data['@context'] && data['@context'] !== 'https://schema.org') {
    errors.push('@context must be exactly "https://schema.org"');
    score -= 15;
  }

  if (data['@type'] && data['@type'] !== 'GolfCourse') {
    errors.push('@type must be exactly "GolfCourse"');
    score -= 15;
  }

  // Validate address structure
  if (data.address) {
    if (!data.address['@type'] || data.address['@type'] !== 'PostalAddress') {
      errors.push('Address must have @type of "PostalAddress"');
      score -= 10;
    }
    if (!data.address.addressLocality) {
      warnings.push('Address should include addressLocality (city)');
      score -= 3;
    }
    if (!data.address.addressRegion) {
      warnings.push('Address should include addressRegion (state)');
      score -= 3;
    }
    if (!data.address.addressCountry) {
      warnings.push('Address should include addressCountry');
      score -= 2;
    }
  }

  // Validate geo coordinates
  if (data.geo) {
    if (!data.geo['@type'] || data.geo['@type'] !== 'GeoCoordinates') {
      errors.push('Geo coordinates must have @type of "GeoCoordinates"');
      score -= 10;
    }
    if (typeof data.geo.latitude !== 'number' || typeof data.geo.longitude !== 'number') {
      errors.push('Geo coordinates must include numeric latitude and longitude');
      score -= 10;
    }
    if (data.geo.latitude < -90 || data.geo.latitude > 90) {
      errors.push('Latitude must be between -90 and 90');
      score -= 10;
    }
    if (data.geo.longitude < -180 || data.geo.longitude > 180) {
      errors.push('Longitude must be between -180 and 180');
      score -= 10;
    }
  }

  // Validate aggregate rating
  if (data.aggregateRating) {
    if (!data.aggregateRating['@type'] || data.aggregateRating['@type'] !== 'AggregateRating') {
      errors.push('AggregateRating must have @type of "AggregateRating"');
      score -= 8;
    }
    if (typeof data.aggregateRating.ratingValue !== 'number') {
      errors.push('AggregateRating must include numeric ratingValue');
      score -= 8;
    }
    if (typeof data.aggregateRating.bestRating !== 'number') {
      warnings.push('AggregateRating should include bestRating');
      score -= 3;
    }
  }

  // Validate amenity features
  if (data.amenityFeature && Array.isArray(data.amenityFeature)) {
    data.amenityFeature.forEach((amenity: any, index: number) => {
      if (!amenity['@type'] || amenity['@type'] !== 'LocationFeatureSpecification') {
        errors.push(`Amenity ${index} must have @type of "LocationFeatureSpecification"`);
        score -= 5;
      }
      if (!amenity.name) {
        errors.push(`Amenity ${index} must include a name`);
        score -= 3;
      }
    });
  }

  // Recommendations for better SEO
  if (!data.url) {
    recommendations.push('Add course website URL for better search visibility');
  }
  if (!data.telephone) {
    recommendations.push('Add contact phone number for enhanced local SEO');
  }
  if (!data.priceRange) {
    recommendations.push('Add pricing information to attract more visitors');
  }
  if (!data.aggregateRating) {
    recommendations.push('Add customer ratings and reviews for better credibility');
  }
  if (!data.amenityFeature || data.amenityFeature.length === 0) {
    recommendations.push('Add course amenities and features for richer search results');
  }

  return {
    isValid: errors.length === 0,
    score: Math.max(0, score),
    errors,
    warnings,
    recommendations
  };
}

/**
 * Validate JSON-LD syntax and structure
 */
function validateJSONLD(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  try {
    // Test JSON serialization
    const jsonString = JSON.stringify(data);

    if (jsonString.length > 10000) {
      warnings.push('Structured data is quite large (>10KB) - consider optimization');
      score -= 5;
    }

    // Test JSON parsing
    const parsed = JSON.parse(jsonString);

    // Verify data integrity
    if (JSON.stringify(parsed) !== jsonString) {
      errors.push('Data corruption during JSON serialization/deserialization');
      score -= 20;
    }

    // Check for circular references
    const seen = new Set();
    function checkCircular(obj: any, path = ''): void {
      if (obj && typeof obj === 'object') {
        if (seen.has(obj)) {
          errors.push(`Circular reference detected at ${path}`);
          score -= 25;
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

    // Check for invalid characters
    if (jsonString.includes('\u0000')) {
      errors.push('Contains null characters which are invalid in JSON');
      score -= 15;
    }

  } catch (error) {
    errors.push(`JSON-LD serialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    score -= 30;
  }

  return {
    isValid: errors.length === 0,
    score: Math.max(0, score),
    errors,
    warnings,
    recommendations
  };
}

/**
 * Test with sample course data
 */
function runValidationTests(): void {
  const sampleCourses: AutomatedCourseDetails[] = [
    {
      id: 'pebble-beach',
      name: 'Pebble Beach Golf Links',
      location: 'Pebble Beach, CA 93953',
      description: 'Legendary oceanfront golf course with stunning Pacific Ocean views',
      phoneNumber: '(831) 622-8723',
      website: 'https://www.pebblebeach.com',
      greensFeePriceRange: '$595-$695',
      publicAccess: true,
      numberOfHoles: 18,
      totalYardage: 6828,
      par: 72,
      architect: 'Jack Neville, Douglas Grant',
      establishedYear: 1919,
      difficulty: 'Championship',
      qualityScore: 95,
      completenessScore: 98,
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    } as AutomatedCourseDetails,

    {
      id: 'minimal-course',
      name: 'Test Golf Course',
      location: 'Test City, TX 12345',
      qualityScore: 70,
      completenessScore: 75,
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    } as AutomatedCourseDetails
  ];

  console.log('\n🏌️  Golf Course Structured Data Validation Report\n');
  console.log('=' .repeat(60));

  let totalScore = 0;
  let passedTests = 0;

  sampleCourses.forEach((course, index) => {
    console.log(`\n📍 Course ${index + 1}: ${course.name}`);
    console.log('-'.repeat(40));

    // Generate structured data
    const structuredData = generateStructuredData(course);

    // Validate Schema.org compliance
    const schemaValidation = validateSchemaOrgCompliance(structuredData);
    console.log(`\n📋 Schema.org Compliance:`);
    console.log(`   Score: ${schemaValidation.score}/100`);
    console.log(`   Status: ${schemaValidation.isValid ? '✅ PASS' : '❌ FAIL'}`);

    if (schemaValidation.errors.length > 0) {
      console.log(`   Errors (${schemaValidation.errors.length}):`);
      schemaValidation.errors.forEach(error => console.log(`     • ${error}`));
    }

    if (schemaValidation.warnings.length > 0) {
      console.log(`   Warnings (${schemaValidation.warnings.length}):`);
      schemaValidation.warnings.forEach(warning => console.log(`     • ${warning}`));
    }

    // Validate JSON-LD structure
    const jsonValidation = validateJSONLD(structuredData);
    console.log(`\n🔍 JSON-LD Validation:`);
    console.log(`   Score: ${jsonValidation.score}/100`);
    console.log(`   Status: ${jsonValidation.isValid ? '✅ PASS' : '❌ FAIL'}`);

    if (jsonValidation.errors.length > 0) {
      console.log(`   Errors (${jsonValidation.errors.length}):`);
      jsonValidation.errors.forEach(error => console.log(`     • ${error}`));
    }

    // Overall assessment
    const overallScore = Math.round((schemaValidation.score + jsonValidation.score) / 2);
    const passed = schemaValidation.isValid && jsonValidation.isValid;

    console.log(`\n📊 Overall Assessment:`);
    console.log(`   Combined Score: ${overallScore}/100`);
    console.log(`   Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);

    if (schemaValidation.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      schemaValidation.recommendations.forEach(rec => console.log(`     • ${rec}`));
    }

    totalScore += overallScore;
    if (passed) passedTests++;
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Tests Run: ${sampleCourses.length}`);
  console.log(`Tests Passed: ${passedTests}`);
  console.log(`Tests Failed: ${sampleCourses.length - passedTests}`);
  console.log(`Average Score: ${Math.round(totalScore / sampleCourses.length)}/100`);
  console.log(`Overall Status: ${passedTests === sampleCourses.length ? '✅ ALL PASS' : '⚠️  SOME FAILURES'}`);

  if (passedTests === sampleCourses.length) {
    console.log('\n🎉 All structured data validation tests passed!');
    console.log('Your golf course pages are ready for rich snippets in search results.');
  } else {
    console.log('\n⚠️  Some validation tests failed. Please review and fix the issues above.');
  }

  logger.info('Structured data validation completed', {
    totalTests: sampleCourses.length,
    passedTests,
    averageScore: Math.round(totalScore / sampleCourses.length)
  });
}

// Run validation if script is executed directly
if (require.main === module) {
  runValidationTests();
}

export {
  validateSchemaOrgCompliance,
  validateJSONLD,
  runValidationTests
};