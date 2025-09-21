import type {
  WikipediaData,
  CourseHistoricalData,
  APIResponse,
  APIError,
  ValidationResult,
} from '../../types/api.types';
import type { WikipediaService } from './wikipedia-service';
import { apiLogger } from '../../utils/logger';

interface ArchitectMatch {
  name: string;
  confidence: number;
  source: 'infobox' | 'text' | 'wikidata';
  type: 'original' | 'renovation' | 'consultant';
}

interface ChampionshipMatch {
  tournament: string;
  years: number[];
  confidence: number;
  winners: Array<{
    year: number;
    winner: string;
    score?: string;
  }>;
}

export class CourseHistoryExtractor {
  private wikipediaService: WikipediaService;

  // Known golf course architects for validation
  private readonly KNOWN_ARCHITECTS = [
    'Donald Ross',
    'Alister MacKenzie',
    'A.W. Tillinghast',
    'Charles Blair Macdonald',
    'Seth Raynor',
    'William Flynn',
    'George Thomas',
    'Tom Fazio',
    'Pete Dye',
    'Jack Nicklaus',
    'Arnold Palmer',
    'Robert Trent Jones',
    'Robert Trent Jones Jr.',
    'Rees Jones',
    'Tom Doak',
    'Bill Coore',
    'Ben Crenshaw',
    'Gil Hanse',
    'C.B. Macdonald',
    'Harry Colt',
    'Tom Simpson',
    'James Braid',
    'Herbert Fowler',
    'Max Behr',
    'George Crump',
    'Dick Wilson',
    'Joe Lee',
    'Arthur Hills',
    'Michael Hurdzan',
    'Dana Fry',
    'Jim Engh',
    'Keith Foster',
    'Ron Whitten',
    'Coore & Crenshaw',
    'Doak & Renaissance',
    'Jones & Jones',
    'Fazio Design',
  ];

  // Major golf championships
  private readonly MAJOR_CHAMPIONSHIPS = [
    'Masters Tournament',
    'U.S. Open',
    'Open Championship',
    'PGA Championship',
    'The Players Championship',
    'Ryder Cup',
    'Presidents Cup',
    'Solheim Cup',
    'Walker Cup',
    'Curtis Cup',
    'U.S. Amateur',
    'British Amateur',
  ];

  // Golf architecture terms and concepts
  private readonly DESIGN_TERMS = [
    'strategic design',
    'penal design',
    'heroic design',
    'links style',
    'parkland style',
    'desert style',
    'mountain course',
    'seaside links',
    'target golf',
    'risk-reward',
    'championship tees',
    'multiple tees',
    'elevation changes',
    'water hazards',
    'bunker placement',
    'green complexes',
    'doglegs',
    'par 3s',
    'par 4s',
    'par 5s',
    'signature hole',
  ];

  constructor(wikipediaService: WikipediaService) {
    this.wikipediaService = wikipediaService;
    apiLogger.info('CourseHistoryExtractor initialized');
  }

  /**
   * Extract comprehensive historical data for a golf course
   */
  async extractHistoricalData(
    courseName: string,
    location: string,
  ): Promise<APIResponse<CourseHistoricalData>> {
    const requestId = `history-extract-${Date.now()}`;
    const startTime = Date.now();

    try {
      apiLogger.info(`Extracting historical data for: ${courseName}`, {
        requestId,
        location,
      });

      // Step 1: Search for course article
      const searchResult = await this.wikipediaService.searchCourseArticle(courseName, location);

      if (!searchResult.success || !searchResult.data) {
        return {
          success: false,
          error: {
            service: 'course-history-extractor',
            endpoint: 'extractHistoricalData',
            message: 'No Wikipedia article found for course',
            originalError: null,
            timestamp: new Date(),
            retryable: false,
          },
          cached: false,
          requestId,
          processingTime: Date.now() - startTime,
        };
      }

      // Step 2: Extract course data from article
      const extractResult = await this.wikipediaService.extractCourseData(searchResult.data);

      if (!extractResult.success || !extractResult.data) {
        return {
          success: false,
          error: extractResult.error || {
            service: 'course-history-extractor',
            endpoint: 'extractHistoricalData',
            message: 'Failed to extract data from Wikipedia article',
            originalError: null,
            timestamp: new Date(),
            retryable: true,
          },
          cached: false,
          requestId,
          processingTime: Date.now() - startTime,
        };
      }

      // Step 3: Process and enhance the extracted data
      const historicalData = this.processHistoricalData(extractResult.data);

      const processingTime = Date.now() - startTime;

      apiLogger.info(`Successfully extracted historical data`, {
        requestId,
        processingTime,
        courseName,
        architect: historicalData.architect,
        openingYear: historicalData.openingYear,
        championships: historicalData.majorChampionships.length,
        renovations: historicalData.renovationYears.length,
      });

      return {
        success: true,
        data: historicalData,
        cached: false,
        requestId,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const apiError: APIError = {
        service: 'course-history-extractor',
        endpoint: 'extractHistoricalData',
        message: error.message || 'Unknown error in history extraction',
        originalError: error,
        timestamp: new Date(),
        retryable: true,
      };

      apiLogger.error('Failed to extract historical data', error, {
        requestId,
        courseName,
        location,
        processingTime,
      });

      return {
        success: false,
        error: apiError,
        cached: false,
        requestId,
        processingTime,
      };
    }
  }

  /**
   * Process Wikipedia data into structured historical data
   */
  private processHistoricalData(wikipediaData: WikipediaData): CourseHistoricalData {
    const result: CourseHistoricalData = {
      architect: '',
      coArchitects: [],
      openingYear: 0,
      renovationYears: [],
      renovationArchitects: [],
      majorChampionships: [],
      designPhilosophy: '',
      notableFeatures: [],
      records: [],
      courseChanges: [],
    };

    // Extract and validate architect information
    const architectInfo = this.extractArchitectInfo(wikipediaData);
    result.architect = architectInfo.primary;
    result.coArchitects = architectInfo.coArchitects;
    result.renovationArchitects = architectInfo.renovationArchitects;

    // Extract opening year
    result.openingYear = this.validateOpeningYear(wikipediaData.openingYear);

    // Extract renovation information
    const renovationInfo = this.extractRenovationInfo(wikipediaData);
    result.renovationYears = renovationInfo.years;
    result.courseChanges = renovationInfo.changes;

    // Extract championship information
    result.majorChampionships = this.extractChampionshipInfo(wikipediaData);

    // Extract design philosophy and features
    result.designPhilosophy = this.extractDesignPhilosophy(wikipediaData);
    result.notableFeatures = this.extractNotableFeatures(wikipediaData);

    // Extract records and achievements
    result.records = this.extractRecords(wikipediaData);

    return result;
  }

  /**
   * Extract detailed architect information
   */
  private extractArchitectInfo(data: WikipediaData): {
    primary: string;
    coArchitects: string[];
    renovationArchitects: string[];
  } {
    const result = {
      primary: '',
      coArchitects: [] as string[],
      renovationArchitects: [] as string[],
    };

    // Validate primary architect
    if (data.architect) {
      const validatedArchitect = this.validateArchitectName(data.architect);
      if (validatedArchitect.isValid) {
        result.primary = validatedArchitect.name;
      }
    }

    // Extract co-architects and renovation architects from text
    const textContent = `${data.summary} ${data.history}`.toLowerCase();

    // Look for multiple architects mentioned together
    const multiArchitectPatterns = [
      /designed by ([^.]+) and ([^.]+)/i,
      /architects[:\s]+([^.]+) and ([^.]+)/i,
      /([^.]+) in collaboration with ([^.]+)/i,
    ];

    multiArchitectPatterns.forEach((pattern) => {
      const match = textContent.match(pattern);
      if (match) {
        const arch1 = this.validateArchitectName(match[1]);
        const arch2 = this.validateArchitectName(match[2]);

        if (arch1.isValid && arch1.name !== result.primary) {
          result.coArchitects.push(arch1.name);
        }
        if (arch2.isValid && arch2.name !== result.primary) {
          result.coArchitects.push(arch2.name);
        }
      }
    });

    // Look for renovation architects
    const renovationPatterns = [
      /renovated by ([^.]+)/i,
      /redesigned by ([^.]+)/i,
      /restored by ([^.]+)/i,
      /modified by ([^.]+)/i,
    ];

    renovationPatterns.forEach((pattern) => {
      const matches = textContent.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        matches.forEach((match) => {
          const architectMatch = match.match(pattern);
          if (architectMatch && architectMatch[1]) {
            const validated = this.validateArchitectName(architectMatch[1]);
            if (validated.isValid && !result.renovationArchitects.includes(validated.name)) {
              result.renovationArchitects.push(validated.name);
            }
          }
        });
      }
    });

    // Remove duplicates
    result.coArchitects = [...new Set(result.coArchitects)];
    result.renovationArchitects = [...new Set(result.renovationArchitects)];

    return result;
  }

  /**
   * Validate architect name against known architects
   */
  private validateArchitectName(name: string): {
    isValid: boolean;
    name: string;
    confidence: number;
  } {
    const cleanName = name.trim().replace(/\s+/g, ' ');

    // Exact match
    const exactMatch = this.KNOWN_ARCHITECTS.find(
      (arch) => arch.toLowerCase() === cleanName.toLowerCase(),
    );

    if (exactMatch) {
      return { isValid: true, name: exactMatch, confidence: 1.0 };
    }

    // Partial match
    const partialMatch = this.KNOWN_ARCHITECTS.find((arch) => {
      const archWords = arch.toLowerCase().split(' ');
      const nameWords = cleanName.toLowerCase().split(' ');

      return (
        archWords.some((word) => nameWords.includes(word)) ||
        nameWords.some((word) => archWords.includes(word))
      );
    });

    if (partialMatch) {
      return { isValid: true, name: partialMatch, confidence: 0.7 };
    }

    // Check if it looks like a person's name (has at least first and last name)
    const words = cleanName.split(' ');
    if (words.length >= 2 && words.every((word) => /^[A-Z][a-z]+/.test(word))) {
      return { isValid: true, name: cleanName, confidence: 0.5 };
    }

    return { isValid: false, name: cleanName, confidence: 0 };
  }

  /**
   * Validate opening year
   */
  private validateOpeningYear(year: number): number {
    const currentYear = new Date().getFullYear();

    // Golf courses typically built between 1850 and current year
    if (year >= 1850 && year <= currentYear) {
      return year;
    }

    return 0; // Invalid year
  }

  /**
   * Extract renovation information
   */
  private extractRenovationInfo(data: WikipediaData): {
    years: number[];
    changes: Array<{
      year: number;
      description: string;
      architect?: string;
    }>;
  } {
    const years: number[] = [];
    const changes: Array<{ year: number; description: string; architect?: string }> = [];

    const textContent = `${data.summary} ${data.history}`;

    // Look for renovation mentions with years
    const renovationPatterns = [
      /renovated in (\d{4})/gi,
      /redesigned in (\d{4})/gi,
      /restored in (\d{4})/gi,
      /modified in (\d{4})/gi,
      /rebuilt in (\d{4})/gi,
      /(\d{4}) renovation/gi,
      /(\d{4}) redesign/gi,
    ];

    renovationPatterns.forEach((pattern) => {
      const matches = textContent.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const yearMatch = match.match(/(\d{4})/);
          if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            if (year >= 1900 && year <= new Date().getFullYear() && !years.includes(year)) {
              years.push(year);

              // Try to extract more context around this renovation
              const contextPattern = new RegExp(`.{0,100}${year}.{0,100}`, 'i');
              const contextMatch = textContent.match(contextPattern);

              if (contextMatch) {
                changes.push({
                  year,
                  description: contextMatch[0].trim(),
                });
              }
            }
          }
        });
      }
    });

    return {
      years: years.sort(),
      changes: changes.sort((a, b) => a.year - b.year),
    };
  }

  /**
   * Extract championship information
   */
  private extractChampionshipInfo(data: WikipediaData): Array<{
    tournament: string;
    years: number[];
    winners: Array<{
      year: number;
      winner: string;
      score?: string;
    }>;
  }> {
    const championships: Array<{
      tournament: string;
      years: number[];
      winners: Array<{
        year: number;
        winner: string;
        score?: string;
      }>;
    }> = [];

    // Process major championships from Wikipedia data
    data.majorChampionships.forEach((championship) => {
      const normalized = this.normalizeTournamentName(championship);

      if (normalized) {
        const years = this.extractYearsFromText(championship);
        championships.push({
          tournament: normalized,
          years,
          winners: [], // Could be enhanced to extract winner details
        });
      }
    });

    // Look for additional tournament information in notable events
    data.notableEvents.forEach((event) => {
      const normalized = this.normalizeTournamentName(event);
      if (normalized && !championships.find((c) => c.tournament === normalized)) {
        const years = this.extractYearsFromText(event);
        championships.push({
          tournament: normalized,
          years,
          winners: [],
        });
      }
    });

    return championships;
  }

  /**
   * Normalize tournament names
   */
  private normalizeTournamentName(text: string): string | null {
    const lowercaseText = text.toLowerCase();

    for (const championship of this.MAJOR_CHAMPIONSHIPS) {
      if (lowercaseText.includes(championship.toLowerCase())) {
        return championship;
      }
    }

    // Look for other notable tournaments
    const otherTournaments = [
      'PGA Tour',
      'LPGA Tour',
      'Champions Tour',
      'Web.com Tour',
      'FedEx Cup',
      'Byron Nelson',
      'Memorial Tournament',
    ];

    for (const tournament of otherTournaments) {
      if (lowercaseText.includes(tournament.toLowerCase())) {
        return tournament;
      }
    }

    return null;
  }

  /**
   * Extract years from text
   */
  private extractYearsFromText(text: string): number[] {
    const years: number[] = [];
    const yearMatches = text.match(/\b(19|20)\d{2}\b/g);

    if (yearMatches) {
      yearMatches.forEach((yearStr) => {
        const year = parseInt(yearStr, 10);
        if (year >= 1900 && year <= new Date().getFullYear()) {
          years.push(year);
        }
      });
    }

    return [...new Set(years)].sort(); // Remove duplicates and sort
  }

  /**
   * Extract design philosophy
   */
  private extractDesignPhilosophy(data: WikipediaData): string {
    const textContent = `${data.summary} ${data.history}`.toLowerCase();
    const philosophyTerms: string[] = [];

    // Look for design-related terms
    this.DESIGN_TERMS.forEach((term) => {
      if (textContent.includes(term.toLowerCase())) {
        philosophyTerms.push(term);
      }
    });

    // Create a design philosophy summary
    if (philosophyTerms.length > 0) {
      return `Course features: ${philosophyTerms.slice(0, 5).join(', ')}`;
    }

    // Fallback to extracting design-related sentences
    const designSentences = data.summary.split('.').filter((sentence) => {
      const lower = sentence.toLowerCase();
      return (
        lower.includes('design') ||
        lower.includes('layout') ||
        lower.includes('challenge') ||
        lower.includes('feature')
      );
    });

    return designSentences.slice(0, 2).join('. ').trim();
  }

  /**
   * Extract notable features
   */
  private extractNotableFeatures(data: WikipediaData): string[] {
    const features: string[] = [];
    const textContent = `${data.summary} ${data.history}`.toLowerCase();

    // Look for hole-specific features
    const holePatterns = [
      /(\d+)(?:st|nd|rd|th) hole/g,
      /signature hole/g,
      /famous hole/g,
      /challenging hole/g,
    ];

    holePatterns.forEach((pattern) => {
      const matches = textContent.match(pattern);
      if (matches) {
        features.push(...matches.slice(0, 3)); // Limit to 3 per pattern
      }
    });

    // Look for course features
    const featurePatterns = [
      /island green/g,
      /water hazard/g,
      /elevated green/g,
      /dogleg/g,
      /bunker complex/g,
      /waste area/g,
    ];

    featurePatterns.forEach((pattern) => {
      const matches = textContent.match(pattern);
      if (matches) {
        features.push(...matches.slice(0, 2));
      }
    });

    return [...new Set(features)].slice(0, 10); // Remove duplicates and limit
  }

  /**
   * Extract records and achievements
   */
  private extractRecords(data: WikipediaData): Array<{
    type: string;
    value: string;
    holder: string;
    date: string;
  }> {
    const records: Array<{
      type: string;
      value: string;
      holder: string;
      date: string;
    }> = [];

    const textContent = `${data.summary} ${data.history}`;

    // Look for course records
    const recordPatterns = [
      /course record[:\s]+(\d+)[^.]*by ([^.]+)/gi,
      /lowest score[:\s]+(\d+)[^.]*by ([^.]+)/gi,
      /tournament record[:\s]+(\d+)[^.]*by ([^.]+)/gi,
    ];

    recordPatterns.forEach((pattern) => {
      const matches = textContent.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const scoreMatch = match.match(/(\d+)/);
          const playerMatch = match.match(/by ([^.]+)/i);

          if (scoreMatch && playerMatch) {
            records.push({
              type: 'Course Record',
              value: scoreMatch[1],
              holder: playerMatch[1].trim(),
              date: '', // Could be enhanced to extract dates
            });
          }
        });
      }
    });

    return records.slice(0, 5); // Limit to 5 records
  }

  /**
   * Validate extracted historical data
   */
  validateHistoricalData(data: CourseHistoricalData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate architect
    if (!data.architect) {
      warnings.push('No architect information found');
    }

    // Validate opening year
    if (data.openingYear === 0) {
      warnings.push('No opening year found');
    } else if (data.openingYear < 1850 || data.openingYear > new Date().getFullYear()) {
      errors.push(`Invalid opening year: ${data.openingYear}`);
    }

    // Validate renovation years
    data.renovationYears.forEach((year) => {
      if (year < data.openingYear) {
        errors.push(`Renovation year ${year} is before opening year ${data.openingYear}`);
      }
    });

    // Validate championships
    if (data.majorChampionships.length === 0) {
      warnings.push('No major championships found');
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
}
