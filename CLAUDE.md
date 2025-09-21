# Golf Journey Map - Web Scraper Project

## Tech Stack
- **Runtime**: Node.js 18+ with TypeScript 5.3+
- **Framework**: Express.js for API endpoints, Next.js 14+ for frontend
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Scraping**: Puppeteer 21+, Playwright 1.40+, Cheerio 1.0+
- **Image Processing**: Sharp 0.33+, Jimp 0.22+
- **APIs**: OpenWeather, Wikipedia, OpenStreetMap/Overpass
- **SEO**: next-seo, react-helmet-async, web-vitals monitoring
- **Testing**: Jest 29+, Playwright Test (42 SEO tests passing)
- **Linting**: ESLint 8+, Prettier 3+
- **Automation**: node-cron, node-schedule, Bull queues, Prometheus metrics
- **Monitoring**: Winston logger, Health monitoring, Alert management (Email/Slack)
- **Maintenance**: Automated database optimization, file system cleanup

## Project Structure
```
/prisma/            # Database schema and migrations
  schema.prisma     # Complete database schema with 13+ models
/src/
  /config/          # Configuration management with validation
    config.ts       # Environment configuration loader
  /scripts/         # Automation and utility scripts
    seed.ts         # Database seeding script
    enrich-courses.ts  # API enrichment orchestration (520 lines)
    process-images.ts  # Image processing automation (428 lines)
  /services/        # Core business logic (scrapers, APIs, processors)
    /api/           # API integration services
      api-manager.ts  # Centralized API coordination with rate limiting
    /weather/       # Weather API services
      weather-service.ts  # OpenWeather API integration
      weather-cache.ts    # Intelligent weather data caching
    /wikipedia/     # Wikipedia/Wikidata services
      wikipedia-service.ts     # Article search and extraction
      course-history-extractor.ts  # Historical data parsing
    /osm/          # OpenStreetMap services
      osm-service.ts  # Overpass API and Nominatim integration
    /seo/          # SEO optimization services (✅ NEW)
      content-optimizer.ts    # Golf-specific content enhancement
      seo-monitor.ts          # Performance tracking & Core Web Vitals
      seo-metadata-generator.ts # Meta tags, titles, descriptions
      structured-data-generator.ts # Schema.org JSON-LD markup
      social-meta-generator.ts     # Open Graph & Twitter Cards
    /media/         # Image processing and media management
      image-downloader.ts     # Multi-source image downloading
      image-optimizer.ts      # Multi-format optimization (WebP, JPEG, PNG)
      image-enhancer.ts       # Golf-optimized enhancement pipeline
      alt-text-generator.ts   # AI-powered accessibility text generation
      image-validator.ts      # Quality assessment and scoring
      media-manager.ts        # File organization and metadata
      media-database.ts       # Database integration for media
    automated-data-collector.ts # Multi-source data collection orchestration (✅ NEW)
    schedule-manager.ts         # Cron job automation and task scheduling (✅ NEW)
    health-monitor.ts           # System health monitoring with Prometheus (✅ NEW)
    alert-manager.ts            # Email/Slack alerting system (✅ NEW)
    progress-tracker.ts         # Real-time progress tracking and reporting (✅ NEW)
  /types/           # TypeScript type definitions
    api.types.ts    # API service type definitions (456 lines)
    config.types.ts # Type-safe configuration interfaces
    media.types.ts  # Image processing and media types (117 lines)
    quality.types.ts # Quality assessment & course data types
    seo.types.ts    # SEO metadata and structured data types
    automation.types.ts # Automation workflow and monitoring types (✅ NEW)
  /utils/           # Core utilities and helpers
    database.ts     # Database connection management
    data-validation.ts  # Data validation and cleaning utilities (574 lines)
    errors.ts       # Error handling and custom error types
    logger.ts       # Winston logging system
    storage.ts      # File storage management
  /components/      # React components for course pages (✅ NEW)
    course-hero-section.tsx     # Hero section with weather integration
    course-details-section.tsx  # Course specifications & amenities
    course-history-section.tsx  # Timeline & championship history
    photo-gallery-section.tsx   # Lightbox gallery with accessibility
    nearby-amenities-section.tsx # Local attractions & services
    contact-booking-section.tsx  # Contact forms & tee time booking
    error-boundary.tsx           # Error boundaries for reliability
  /pages/           # Next.js pages for frontend (✅ NEW)
    _app.tsx        # App-wide configuration & SEO setup
    _document.tsx   # HTML document structure & meta tags
    /courses/       # Dynamic course detail pages
      [...slug].tsx # Course detail page with SSG/SSR
  /__tests__/       # Comprehensive test suites
    /media/         # Image processing pipeline tests
    /seo/           # SEO metadata & structured data tests (42 tests)
    /automation/    # Automation system tests (✅ NEW)
  /scripts/         # Automation and maintenance scripts (✅ NEW)
    master-automation.ts      # Complete automation orchestrator (650+ lines)
    database-maintenance.ts   # Database optimization and cleanup
    filesystem-cleanup.ts     # File system maintenance and cleanup
  index.ts          # Application entry point
/scripts/           # Shell scripts for cron jobs (✅ NEW)
  update-weather-data.sh     # Daily weather update automation
  validate-all-data.sh       # Weekly comprehensive validation
  monthly-automation.sh      # Monthly full refresh and maintenance
  system-maintenance.sh      # System-wide maintenance tasks
/data/              # Temporary data storage and processing
/media/             # Course images and media files (auto-organized)
  /courses/         # Course-specific media organization
    /{courseId}/    # Individual course media directories
      /original/    # Downloaded source images
      /optimized/   # Multi-format processed variants
        /hero/      # Main course hero images
        /gallery/   # Photo gallery images
        /maps/      # Course layout and scorecard images
        /amenities/ # Facility and amenity photos
      /thumbnails/  # Small preview images
      metadata.json # Course media metadata and alt text
/logs/              # Application logs with rotation
/reports/           # Processing and quality reports
/.claude/           # Claude-specific configurations
  /commands/        # Custom slash commands
```

## Key Commands
### Core Development
- `npm run dev` - Start development server with tsx watch mode
- `npm run build` - Build TypeScript for production
- `npm run start` - Run production build
- `npm run clean` - Clean build artifacts

### Database Management
- `npm run db:generate` - Generate Prisma client types
- `npm run db:migrate` - Run database migrations (dev)
- `npm run db:migrate:prod` - Run production migrations
- `npm run db:seed` - Seed database with initial data
- `npm run db:studio` - Open Prisma Studio GUI

### Testing & Quality
- `npm run test` - Run complete test suite
- `npm run test:unit` - Unit tests only
- `npm run test:integration` - Integration tests only
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - ESLint + Prettier code formatting
- `npm run format` - Auto-format code with Prettier
- `npm run typecheck` - TypeScript type checking only

### Automation Scripts
- `npm run scrape:courses` - Run course data collection
- `npm run enrich:courses` - Enrich courses with API data (weather, history, location)
- `npm run process:images` - Process and optimize course images
- `npm run generate:pages` - Generate SEO-optimized course pages (✅ NEW)
- `npm run monitor:health` - Check system health metrics

### SEO & Frontend Scripts (✅ NEW)
- `npm run build` - Build Next.js production frontend
- `npm run dev:frontend` - Start Next.js development server
- `npm run validate:seo` - Validate structured data compliance
- `npm run test:seo` - Run 42 SEO validation tests

### Data Quality & Validation
- `npm run validate:data` - Run comprehensive data quality validation
- `npm run validate:course -- --id=123` - Validate specific course data
- `npm run quality:report` - Generate quality assessment reports
- `npm run quality:demo` - Run quality system demonstration

### Automation & Scheduling (✅ NEW)
- `npm run automation:run` - Execute master automation workflow
- `npm run automation:collect` - Run automated data collection
- `npm run automation:schedule` - Start cron job scheduler
- `npm run automation:health` - Monitor system health
- `npm run automation:progress` - Track automation progress

### Maintenance & Cleanup (✅ NEW)
- `npm run maintenance:database` - Database optimization and cleanup
- `npm run maintenance:filesystem` - File system cleanup and organization
- `npm run maintenance:full` - Complete system maintenance
- `npm run maintenance:quick` - Quick maintenance tasks

### Scheduled Tasks (✅ NEW)
- `npm run scheduled:weather` - Daily weather data updates
- `npm run scheduled:validate` - Weekly comprehensive validation
- `npm run scheduled:monthly` - Monthly full refresh and maintenance

## Web Scraping Configuration

### Rate Limiting & Ethics
- **Default Rate**: 1 request per 2 seconds per domain
- **Respect robots.txt**: Always check compliance before scraping
- **User Agent**: `Mozilla/5.0 (compatible; GolfCourseBot/1.0)`
- **Concurrent Requests**: Max 3 per domain
- **Retry Strategy**: Exponential backoff (2^attempt seconds, max 5 attempts)
- **Circuit Breaker**: Stop if error rate > 50%

### Error Handling Patterns
```typescript
// Custom exception hierarchy implemented in src/utils/errors.ts
BaseError           // Base class for all custom errors
NetworkError        // Connection/timeout issues
ParseError          // HTML parsing failures
RateLimitError      // Rate limit violations
ValidationError     // Data validation errors
DatabaseError       // Database operation failures
ConfigurationError  // Configuration issues
FileSystemError     // File system operations
ScrapingError       // Scraping-specific errors
APIError           // External API errors
ProcessingError    // Data processing errors

// Additional patterns
CircuitBreaker     // Prevent cascading failures
retryWithBackoff() // Exponential backoff retries
```

### Free API Integrations (✅ Implemented)
- **OpenWeather**: 60 calls/min, 1000/day free tier
  - Golf-optimized weather insights with playability analysis
  - Current conditions + 3-day forecasts for course planning
  - Imperial units for US golf courses
- **Wikipedia/Wikidata**: Unlimited, no API key required
  - Historical course information and architect data
  - Notable championships and renovation history
  - Multiple search strategies for maximum coverage
- **OpenStreetMap Overpass**: 10 queries/min recommended
  - Location data with nearby amenities and features
  - Precise coordinates and address validation
  - Fallback to Nominatim for geocoding
- **Nominatim Geocoding**: 1 request/second limit

## Data Quality Standards
- **Completeness Threshold**: 95% for required fields
- **Quality Score Minimum**: 70/100 for auto-approval
- **Manual Review Trigger**: Score < 60 or >3 validation errors
- **Cross-validation**: Minimum 2 sources for critical data
- **Image Requirements**: 1200px+ width for hero images

## Automation Schedules (✅ ENHANCED)
- **Daily (2 AM)**: Weather updates via OpenWeather API, broken link checks, image optimization
- **Weekly (Sunday 3 AM)**: Full data validation, Wikipedia content enhancement, SEO analysis
- **Monthly (1st, 4 AM)**: Complete data refresh, database maintenance, OSM location updates, photo gallery updates
- **Maintenance (Various)**: Database optimization, file system cleanup, log rotation, backup verification

## Security & Compliance
- **No PII Storage**: Personal information handling prohibited
- **GDPR Compliance**: EU citizen data protection
- **Rate Limiting**: Respect server constraints
- **Public Data Only**: No authentication bypass attempts
- **Error Logging**: Sanitize all logged data

## Development Workflow

### Pre-commit Hooks
- ESLint + Prettier formatting
- TypeScript type checking
- Unit test execution
- Data validation schema checks

### Post-edit Actions
- Image optimization on media changes
- SEO metadata regeneration on content updates
- Quality score recalculation on data changes

### Testing Strategy
- **Unit Tests**: 80%+ coverage requirement
- **Integration Tests**: API and database interactions
- **E2E Tests**: Complete automation workflows
- **Performance Tests**: Scraping rate limits and memory usage

## Monitoring & Alerting (✅ ENHANCED)
- **System Health**: CPU > 90%, Memory > 85% alerts with Prometheus metrics
- **Database Performance**: Query time > 1000ms warnings, connection monitoring
- **Automation Failures**: >20% failure rate alerts with detailed error tracking
- **API Status**: External service downtime notifications with circuit breakers
- **Progress Tracking**: Real-time automation progress with ETA calculations
- **Alert Channels**: Email and Slack notifications with priority-based routing
- **Health Dashboards**: Comprehensive monitoring with historical trend analysis

## Data Quality & Validation System (✅ Implemented)
- **Multi-Dimensional Scoring**: Completeness (30%), Accuracy (25%), Consistency (20%), Reliability (15%), Freshness (10%)
- **Quality Thresholds**: Manual review (<70), Auto-approval (≥90), Minimum completeness (75%)
- **Field Validation**: 13+ golf course fields with customizable rules (required, format, range, pattern, cross-reference)
- **Cross-Source Validation**: Multi-source conflict detection and consensus building with confidence scoring
- **Data Enhancement**: Automated improvement with smart inference and format standardization
- **Monitoring & Reporting**: Real-time tracking, trend analysis, and comprehensive quality reports
- **Issue Detection**: 10+ types including missing fields, format errors, consistency violations
- **Batch Processing**: Configurable concurrent quality assessments with progress tracking
- **Configuration**: Runtime customization of rules, thresholds, and enhancement settings

## Image Processing Pipeline (✅ Implemented)
- **Formats**: WebP (primary), JPEG (fallback), PNG, AVIF support
- **Responsive Sizes**: SM (400px), MD (800px), LG (1200px), XL (1920px)
- **Optimization**: 85% quality, progressive JPEG, mozjpeg compression
- **Enhancement**: Golf-optimized color correction, sharpening, gamma adjustment
- **Quality Validation**: 0-100 scoring with automated recommendations
- **Alt Text**: AI-generated with golf course context and accessibility compliance
- **Source Support**: Official websites, Wikipedia Commons, Pexels, government sources
- **Rate Limiting**: 1 request per 2 seconds, max 50MB file size
- **Error Handling**: Comprehensive retry logic with exponential backoff
- **Batch Processing**: CLI tools for single course or bulk operations

## SEO & Frontend Implementation (✅ NEW - PR6 Complete)
- **Course Detail Pages**: Complete Next.js implementation with SSG/SSR
- **SEO Metadata**: Automated generation of titles, descriptions, keywords
- **Structured Data**: 100% Schema.org compliant JSON-LD markup
- **Social Media**: Open Graph & Twitter Card optimization
- **Performance**: Core Web Vitals monitoring and optimization
- **Accessibility**: WCAG compliant with automated alt text generation
- **Error Handling**: React error boundaries with graceful degradation
- **Testing**: 42 passing SEO tests validating all functionality

## Performance Targets (✅ ENHANCED)
- **Page Load**: <3 seconds for course detail pages
- **Core Web Vitals**: LCP <2.5s, FID <100ms, CLS <0.1 (✅ Monitored)
- **SEO Score**: 95+ Google PageSpeed Insights
- **API Response**: <500ms for data queries
- **Batch Processing**: 100 courses in <2 hours with progress tracking
- **Automation Efficiency**: 95%+ success rate for scheduled tasks
- **System Uptime**: 99.9% availability with health monitoring
- **Data Freshness**: Weather updated daily, comprehensive validation weekly

## File Organization
- Original images: `/media/courses/{courseId}/original/`
- Processed images: `/media/courses/{courseId}/optimized/`
- Temporary data: `/data/temp/` (auto-cleanup after 7 days)
- Reports: `/reports/` (archive monthly)

## Common Debugging Commands
- `npm run debug:scraper -- --course-id=123` - Debug specific course
- `npm run enrich:courses -- --name "Pebble Beach" --limit 1` - Test API enrichment for specific course
- `npm run enrich:courses -- --state CA --weather true --history false` - Weather-only enrichment for California
- `npm run process:images -- --course-id "pebble-beach" --course-name "Pebble Beach" --images "url1,url2" --enhance --thumbnails` - Process images for specific course
- `npm run process:images -- --batch-file "./data/courses.json"` - Batch process images from file
- `npm run validate:data` - Run comprehensive data quality validation
- `npm run validate:course -- --id=123` - Validate single course data
- `npm run quality:report -- --timeframe=weekly` - Generate quality assessment reports
- `npm run quality:demo` - Demonstrate quality system features
- `npm run logs:recent` - Show last 100 log entries
- `npm run health:check` - Quick system health verification

## Architecture Notes (✅ ENHANCED)
- **Microservices Pattern**: Separate services for scraping, validation, image processing, API integration, data quality
- **Frontend Architecture**: Next.js 14+ with TypeScript, SSG/SSR, and React 18
- **SEO Infrastructure**: 5 specialized SEO services with automated optimization
- **API Integration**: 3 external APIs with centralized management, rate limiting, and circuit breakers
- **Data Quality System**: 9 specialized services for comprehensive quality assessment and enhancement
- **Automation System**: Complete workflow orchestration with scheduling, monitoring, and maintenance (✅ NEW)
- **Health Monitoring**: Real-time system monitoring with Prometheus metrics and alerting (✅ NEW)
- **Task Scheduling**: Cron-based automation with retry logic and progress tracking (✅ NEW)
- **Alert Management**: Multi-channel notifications (Email/Slack) with priority routing (✅ NEW)
- **Maintenance Automation**: Database optimization, file cleanup, and system health checks (✅ NEW)
- **Smart Caching**: Node-cache with service-specific TTL (30min weather, 24hr Wikipedia/OSM)
- **Queue System**: Bull/Redis for batch job management with task queues (✅ ENHANCED)
- **Database**: PostgreSQL with Prisma ORM, 13+ models, optimized indexes, automated maintenance
- **Media Pipeline**: Complete image processing with Sharp, multi-format optimization
- **Quality Pipeline**: Multi-dimensional scoring, cross-validation, automated enhancement
- **SEO Pipeline**: Automated metadata generation, structured data, social media optimization
- **Logging**: Winston with daily rotation, category-specific loggers, automated cleanup
- **Storage**: Automated directory management, course-specific organization, cleanup automation
- **Error Handling**: 10+ custom error types, circuit breaker, exponential backoff, React error boundaries
- **Configuration**: Type-safe with Joi validation, comprehensive API and quality settings
- **Data Quality**: 9 quality services with 25+ validation rules and enhancement algorithms
- **Testing**: Comprehensive unit, integration, and E2E test coverage (42 SEO tests, 100% quality system)
- **Accessibility**: Auto-generated alt text for WCAG compliance
- **Horizontal Scaling**: Stateless services for easy scaling with load balancing support

## Automation System Overview (✅ NEW - PR7)

### Master Automation Workflow
The Golf Journey Map now features a comprehensive automation system that handles end-to-end data collection, processing, and maintenance with minimal manual intervention.

#### Core Components:
1. **Master Orchestrator** (`master-automation.ts`) - Coordinates complete automation workflows
2. **Data Collector** (`automated-data-collector.ts`) - Multi-source data collection with parallel processing
3. **Schedule Manager** (`schedule-manager.ts`) - Cron-based task scheduling with retry logic
4. **Health Monitor** (`health-monitor.ts`) - Real-time system monitoring with Prometheus metrics
5. **Alert Manager** (`alert-manager.ts`) - Multi-channel notification system (Email/Slack)
6. **Progress Tracker** (`progress-tracker.ts`) - Real-time progress monitoring and reporting

#### Automation Schedules:
- **Daily**: Weather updates, broken link checks, image optimization
- **Weekly**: Full data validation, content enhancement, SEO analysis
- **Monthly**: Complete data refresh, database maintenance, system optimization

#### Monitoring & Alerting:
- CPU, memory, and disk usage monitoring with configurable thresholds
- Database performance tracking with query time analysis
- Automation failure detection with detailed error reporting
- Multi-channel notifications with priority-based routing
- Progress tracking with ETA calculations and success metrics

#### Maintenance Automation:
- Database optimization with index rebuilding and statistics updates
- File system cleanup with log rotation and orphaned file removal
- System health checks with automated issue detection
- Backup verification and old data archival

### Getting Started with Automation:
```bash
# Start the automation system
npm run automation:run

# Monitor system health
npm run automation:health

# Run maintenance tasks
npm run maintenance:full

# Execute scheduled tasks manually
npm run scheduled:weather
npm run scheduled:validate
npm run scheduled:monthly
```

## Emergency Procedures (✅ ENHANCED)
- **Rate Limit Violations**: Automatically pause scraping for 1 hour with circuit breaker
- **Database Connection Loss**: Retry with exponential backoff and health monitoring
- **Automation Failures**: Alert system with detailed error tracking and recovery procedures
- **High Resource Usage**: Automated alerting and optional task throttling
- **Data Quality Issues**: Automatic flagging for manual review with detailed reports
- **Disk Space Critical**: Auto-cleanup temp files, alert administrators
- **API Quota Exceeded**: Switch to backup services, reduce frequency