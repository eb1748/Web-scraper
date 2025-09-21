import type {
  ValidationRule,
  ValidationResult,
  AutomatedCourseDetails,
} from '../types/quality.types';
import { apiLogger } from '../utils/logger';

/**
 * Field-level validation with customizable rules
 */
export class FieldValidator {
  private validationRules: ValidationRule[] = [
    {
      field: 'name',
      rules: [
        { type: 'required', params: {}, message: 'Course name is required', severity: 'error' },
        {
          type: 'pattern',
          params: { regex: /^[a-zA-Z0-9\s\-&'\.]+$/ },
          message: 'Invalid characters in course name',
          severity: 'warning'
        },
        {
          type: 'range',
          params: { min: 3, max: 100 },
          message: 'Course name must be between 3 and 100 characters',
          severity: 'warning'
        }
      ],
    },
    {
      field: 'latitude',
      rules: [
        { type: 'required', params: {}, message: 'Latitude is required', severity: 'error' },
        {
          type: 'range',
          params: { min: -90, max: 90 },
          message: 'Latitude must be between -90 and 90',
          severity: 'error'
        },
      ],
    },
    {
      field: 'longitude',
      rules: [
        { type: 'required', params: {}, message: 'Longitude is required', severity: 'error' },
        {
          type: 'range',
          params: { min: -180, max: 180 },
          message: 'Longitude must be between -180 and 180',
          severity: 'error'
        },
      ],
    },
    {
      field: 'phoneNumber',
      rules: [
        {
          type: 'pattern',
          params: { regex: /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/ },
          message: 'Invalid phone number format',
          severity: 'warning'
        },
      ],
    },
    {
      field: 'website',
      rules: [
        {
          type: 'format',
          params: { type: 'url' },
          message: 'Invalid website URL format',
          severity: 'warning'
        },
      ],
    },
    {
      field: 'emailContact',
      rules: [
        {
          type: 'format',
          params: { type: 'email' },
          message: 'Invalid email format',
          severity: 'warning'
        },
      ],
    },
    {
      field: 'openingYear',
      rules: [
        {
          type: 'range',
          params: { min: 1700, max: new Date().getFullYear() },
          message: 'Invalid opening year',
          severity: 'warning'
        },
      ],
    },
    {
      field: 'totalYardage',
      rules: [
        {
          type: 'range',
          params: { min: 3000, max: 8500 },
          message: 'Total yardage seems unusual for a golf course',
          severity: 'warning'
        },
      ],
    },
    {
      field: 'parScore',
      rules: [
        {
          type: 'range',
          params: { min: 54, max: 90 },
          message: 'Par score seems unusual for a golf course',
          severity: 'warning'
        },
      ],
    },
    {
      field: 'numberOfHoles',
      rules: [
        {
          type: 'pattern',
          params: { values: [9, 18, 27, 36] },
          message: 'Number of holes should typically be 9, 18, 27, or 36',
          severity: 'info'
        },
      ],
    },
    {
      field: 'courseRating',
      rules: [
        {
          type: 'range',
          params: { min: 60, max: 80 },
          message: 'Course rating should typically be between 60 and 80',
          severity: 'info'
        },
      ],
    },
    {
      field: 'slopeRating',
      rules: [
        {
          type: 'range',
          params: { min: 55, max: 155 },
          message: 'Slope rating should be between 55 and 155',
          severity: 'warning'
        },
      ],
    },
    {
      field: 'description',
      rules: [
        {
          type: 'range',
          params: { min: 20, max: 2000 },
          message: 'Description should be between 20 and 2000 characters',
          severity: 'info'
        }
      ],
    },
  ];

  /**
   * Validate a specific field against its rules
   */
  async validateField(
    fieldName: string,
    value: any,
    context: AutomatedCourseDetails
  ): Promise<ValidationResult> {
    const rule = this.validationRules.find(r => r.field === fieldName);
    if (!rule) {
      return {
        field: fieldName,
        valid: true,
        errors: [],
        warnings: [],
        info: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];

    for (const validation of rule.rules) {
      const result = await this.applyValidation(fieldName, value, validation, context);

      if (result) {
        switch (result.severity) {
          case 'error':
            errors.push(result.message);
            break;
          case 'warning':
            warnings.push(result.message);
            break;
          case 'info':
            info.push(result.message);
            break;
        }
      }
    }

    return {
      field: fieldName,
      valid: errors.length === 0,
      errors,
      warnings,
      info,
    };
  }

  /**
   * Validate all fields in course data
   */
  async validateAllFields(data: AutomatedCourseDetails): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const rule of this.validationRules) {
      const value = data[rule.field as keyof AutomatedCourseDetails];
      const result = await this.validateField(rule.field, value, data);
      results.push(result);
    }

    return results;
  }

  /**
   * Apply a specific validation rule
   */
  private async applyValidation(
    field: string,
    value: any,
    rule: any,
    context: AutomatedCourseDetails
  ): Promise<{ severity: 'error' | 'warning' | 'info'; message: string } | null> {
    try {
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
          apiLogger.warn(`Unknown validation type: ${rule.type}`);
          return null;
      }
    } catch (error) {
      apiLogger.error(`Validation error for field ${field}`, error);
      return {
        severity: 'error',
        message: `Validation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Validate required fields
   */
  private validateRequired(_field: string, value: any, rule: any): { severity: 'error' | 'warning' | 'info'; message: string } | null {
    if (value === null || value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)) {
      return {
        severity: rule.severity,
        message: rule.message,
      };
    }
    return null;
  }

  /**
   * Validate format (URL, email, etc.)
   */
  private validateFormat(_field: string, value: any, rule: any): { severity: 'error' | 'warning' | 'info'; message: string } | null {
    if (!value) return null; // Optional field

    switch (rule.params.type) {
      case 'url':
        try {
          new URL(value);
          return null;
        } catch {
          return {
            severity: rule.severity,
            message: rule.message,
          };
        }

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return {
            severity: rule.severity,
            message: rule.message,
          };
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Validate numeric ranges or string lengths
   */
  private validateRange(_field: string, value: any, rule: any): { severity: 'error' | 'warning' | 'info'; message: string } | null {
    if (!value && value !== 0) return null; // Optional field

    const { min, max } = rule.params;
    let testValue: number;

    if (typeof value === 'string') {
      testValue = value.length;
    } else if (typeof value === 'number') {
      testValue = value;
    } else {
      return {
        severity: rule.severity,
        message: `Cannot validate range for field type`,
      };
    }

    if ((min !== undefined && testValue < min) || (max !== undefined && testValue > max)) {
      return {
        severity: rule.severity,
        message: rule.message,
      };
    }

    return null;
  }

  /**
   * Validate against regex patterns or value lists
   */
  private validatePattern(_field: string, value: any, rule: any): { severity: 'error' | 'warning' | 'info'; message: string } | null {
    if (!value) return null; // Optional field

    if (rule.params.regex) {
      const regex = new RegExp(rule.params.regex);
      if (!regex.test(value)) {
        return {
          severity: rule.severity,
          message: rule.message,
        };
      }
    }

    if (rule.params.values && Array.isArray(rule.params.values)) {
      if (!rule.params.values.includes(value)) {
        return {
          severity: rule.severity,
          message: rule.message,
        };
      }
    }

    return null;
  }

  /**
   * Validate cross-references between fields
   */
  private async validateCrossReference(
    field: string,
    value: any,
    rule: any,
    context: AutomatedCourseDetails
  ): Promise<{ severity: 'error' | 'warning' | 'info'; message: string } | null> {
    // Example: Check if yardage is consistent with number of holes
    if (field === 'totalYardage' && context.numberOfHoles) {
      const avgYardage = value / context.numberOfHoles;
      if (avgYardage < 200 || avgYardage > 600) {
        return {
          severity: rule.severity,
          message: `Average yardage per hole (${Math.round(avgYardage)}) seems unusual`,
        };
      }
    }

    // Example: Check if par is consistent with number of holes
    if (field === 'parScore' && context.numberOfHoles) {
      const avgPar = value / context.numberOfHoles;
      if (avgPar < 3 || avgPar > 5) {
        return {
          severity: rule.severity,
          message: `Average par per hole (${avgPar.toFixed(1)}) seems unusual`,
        };
      }
    }

    return null;
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: ValidationRule): void {
    const existingIndex = this.validationRules.findIndex(r => r.field === rule.field);
    if (existingIndex >= 0) {
      this.validationRules[existingIndex] = rule;
    } else {
      this.validationRules.push(rule);
    }
  }

  /**
   * Remove validation rule for field
   */
  removeValidationRule(fieldName: string): void {
    this.validationRules = this.validationRules.filter(r => r.field !== fieldName);
  }

  /**
   * Get all validation rules
   */
  getValidationRules(): ValidationRule[] {
    return [...this.validationRules];
  }
}

// Export singleton instance
export const fieldValidator = new FieldValidator();