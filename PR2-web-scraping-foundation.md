# PR 2: Web Scraping Foundation and Core Tools

*Core scraping infrastructure for golf course websites and public directories*

## 🎯 **Objective**

Implement robust web scraping infrastructure to collect golf course data from official websites and public directories using free, accessible tools.

## 🛠 **Core Scraping Tools**

### **Primary Scraping Stack (Free Tools Only)**

```bash
# Core scraping dependencies
npm install puppeteer playwright cheerio axios
npm install jsdom node-html-parser
npm install tough-cookie user-agents
```

### **1. Static Content Scraper**

```typescript
// src/scrapers/static-scraper.ts
interface ScrapingTarget {
  url: string;
  selectors: {
    name?: string;
    description?: string;
    phone?: string;
    email?: string;
    address?: string;
    pricing?: string;
    amenities?: string[];
  };
}

class StaticContentScraper {
  private axios: AxiosInstance;

  constructor() {
    this.axios = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GolfCourseBot/1.0)',
      },
    });
  }

  async scrapeBasicInfo(target: ScrapingTarget): Promise<CourseBasicInfo> {
    // 1. Fetch HTML content with error handling
    // 2. Parse with Cheerio for fast DOM manipulation
    // 3. Extract structured data using selectors
    // 4. Clean and normalize extracted text
    // 5. Return structured course information
  }

  async extractContactInfo(html: string): Promise<ContactInfo> {
    // Extract phone numbers, emails, addresses using regex
    // Validate and format contact information
    // Handle multiple formats and variations
  }
}
```

### **2. Dynamic Content Scraper**

```typescript
// src/scrapers/dynamic-scraper.ts
class DynamicContentScraper {
  private browser: Browser;

  async initBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async scrapeJavaScriptSite(url: string): Promise<CourseData> {
    const page = await this.browser.newPage();

    // Set user agent and viewport
    await page.setUserAgent('Mozilla/5.0 (compatible; GolfCourseBot/1.0)');
    await page.setViewport({ width: 1280, height: 720 });

    try {
      // Navigate and wait for content to load
      await page.goto(url, { waitUntil: 'networkidle2' });

      // Wait for specific content to appear
      await page.waitForSelector('body', { timeout: 10000 });

      // Extract data using page.evaluate
      const courseData = await page.evaluate(() => {
        // Extract course information from DOM
        // Handle dynamic content and lazy loading
        // Return structured data
      });

      return courseData;
    } finally {
      await page.close();
    }
  }
}
```

## 🌐 **Target Data Sources (Free/Public)**

### **Tier 1: Official Course Websites**
- **Target Data**: Course descriptions, contact info, pricing, amenities
- **Method**: Direct website scraping with respect for robots.txt
- **Rate Limiting**: 1 request per 2 seconds per domain
- **Fallback**: Manual backup list for critical courses

### **Tier 2: Public Golf Directories**
- **Golf.com course directory** (public pages)
- **Local golf association websites** (state/regional)
- **Municipal recreation department sites**
- **TripAdvisor golf pages** (public reviews and basic info)

### **Tier 3: Community Sources**
- **Golf forum discussions** (course reviews and updates)
- **Local news golf coverage** (tournament reports, course news)
- **Social media public posts** (recent photos, conditions)

## 🔧 **Scraping Infrastructure**

### **1. Request Management**

```typescript
// src/scrapers/request-manager.ts
class RequestManager {
  private requestQueue: Queue<ScrapingRequest>;
  private rateLimiter: Map<string, number>;

  async addRequest(request: ScrapingRequest): Promise<void> {
    // Add to queue with priority based on data source tier
    // Apply domain-specific rate limiting
    // Handle retries with exponential backoff
  }

  async processQueue(): Promise<void> {
    // Process requests respecting rate limits
    // Handle errors and retries gracefully
    // Log progress and results
  }

  private async respectRateLimit(domain: string): Promise<void> {
    // Implement per-domain rate limiting
    // Default: 1 request per 2 seconds
    // Configurable per domain in settings
  }
}
```

### **2. Robot.txt Compliance**

```typescript
// src/scrapers/robots-checker.ts
class RobotsChecker {
  private robotsCache: Map<string, RobotsDirective>;

  async canScrape(url: string, userAgent: string): Promise<boolean> {
    // Check robots.txt for scraping permissions
    // Cache robots.txt files to avoid repeated requests
    // Respect crawl delays and disallowed paths
  }

  async getRobotsTxt(domain: string): Promise<RobotsDirective> {
    // Fetch and parse robots.txt
    // Handle missing or malformed robots.txt files
    // Return scraping permissions for user agent
  }
}
```

### **3. Data Extraction Patterns**

```typescript
// src/scrapers/extraction-patterns.ts
interface ExtractionPattern {
  domain: string;
  selectors: {
    courseName: string[];
    description: string[];
    phone: string[];
    email: string[];
    address: string[];
    pricing: string[];
    images: string[];
  };
  cleaningRules: {
    removeElements: string[];
    textReplacements: Map<string, string>;
  };
}

class PatternMatcher {
  private patterns: Map<string, ExtractionPattern>;

  getPattern(url: string): ExtractionPattern {
    // Match URL to appropriate extraction pattern
    // Return default pattern if no specific match
    // Support wildcard and regex matching
  }

  extractData(html: string, pattern: ExtractionPattern): CourseData {
    // Apply extraction pattern to HTML
    // Clean and normalize extracted data
    // Handle missing or malformed data gracefully
  }
}
```

## 📊 **Data Collection Scripts**

### **Script 1: Course Website Scraper**

```typescript
// scripts/scrape-course-websites.ts
async function scrapeCourseWebsites(courseList: CourseTarget[]) {
  const scraper = new StaticContentScraper();
  const results: ScrapingResult[] = [];

  for (const course of courseList) {
    try {
      // 1. Check robots.txt compliance
      // 2. Scrape basic course information
      // 3. Extract contact and pricing data
      // 4. Download and process images
      // 5. Validate and clean extracted data
      // 6. Store results with confidence scores
    } catch (error) {
      // Log errors and continue with next course
      // Mark course for manual review if critical
    }
  }

  return results;
}
```

### **Script 2: Directory Aggregator**

```typescript
// scripts/aggregate-directories.ts
async function aggregateFromDirectories(sources: DirectorySource[]) {
  // 1. Scrape public golf directories
  // 2. Cross-reference course information
  // 3. Merge data from multiple sources
  // 4. Resolve conflicts using confidence scoring
  // 5. Flag discrepancies for manual review
}
```

## ⚡ **Performance and Error Handling**

### **Rate Limiting Strategy**
- **Default**: 1 request per 2 seconds per domain
- **Respectful crawling**: Honor robots.txt crawl delays
- **Exponential backoff**: 2^attempt seconds for retries
- **Circuit breaker**: Stop scraping if error rate > 50%

### **Error Recovery**
```typescript
interface ScrapingError {
  type: 'network' | 'parsing' | 'validation' | 'rate_limit';
  url: string;
  attempt: number;
  timestamp: Date;
  message: string;
}

class ErrorHandler {
  async handleScrapingError(error: ScrapingError): Promise<RetryAction> {
    // Determine appropriate retry strategy
    // Log error for monitoring and debugging
    // Update course status for manual review if needed
  }
}
```

## 📋 **Acceptance Criteria**

- [ ] Static content scraper implemented and tested
- [ ] Dynamic content scraper with Puppeteer working
- [ ] Robots.txt compliance checker functional
- [ ] Rate limiting system operational
- [ ] Error handling and retry logic implemented
- [ ] Pattern matching for different course websites
- [ ] Request queue management system
- [ ] Data extraction and cleaning utilities
- [ ] Comprehensive logging and monitoring

## 🔍 **Testing Requirements**

- Unit tests for scraping functions
- Integration tests with sample course websites
- Rate limiting compliance tests
- Error handling scenario tests
- Pattern matching accuracy tests

## 📚 **Dependencies**

```bash
# Core scraping tools
npm install puppeteer playwright cheerio axios
npm install jsdom node-html-parser tough-cookie
npm install user-agents robots-parser url-parse
```

## 🚀 **Expected Outcomes**

- Robust scraping infrastructure for 100+ course websites
- Respectful and compliant web scraping practices
- Reliable data extraction with error recovery
- Scalable system for ongoing data collection
- Foundation for automated course data gathering

This PR provides the essential scraping infrastructure needed to collect course data from freely accessible web sources while maintaining ethical scraping practices.