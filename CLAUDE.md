# Golf Journey Map - Web Scraper Project

## Tech Stack
- **Runtime**: Node.js 18+ with TypeScript 5.3+
- **Framework**: Express.js for API endpoints
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Scraping**: Puppeteer 21+, Playwright 1.40+, Cheerio 1.0+
- **Image Processing**: Sharp 0.33+, Jimp 0.22+
- **APIs**: OpenWeather, Wikipedia, OpenStreetMap/Overpass
- **Testing**: Jest 29+, Playwright Test
- **Linting**: ESLint 8+, Prettier 3+
- **Monitoring**: Winston logger, Prometheus metrics

## Project Structure
```
/prisma/            # Database schema and migrations
  schema.prisma     # Complete database schema with 8 models
/src/
  /config/          # Configuration management with validation
    config.ts       # Environment configuration loader
  /scripts/         # Automation and utility scripts
    seed.ts         # Database seeding script
    enrich-courses.ts  # API enrichment orchestration (520 lines)
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
  /types/           # TypeScript type definitions
    api.types.ts    # API service type definitions (456 lines)
    config.types.ts # Type-safe configuration interfaces
  /utils/           # Core utilities and helpers
    database.ts     # Database connection management
    data-validation.ts  # Data validation and cleaning utilities (574 lines)
    errors.ts       # Error handling and custom error types
    logger.ts       # Winston logging system
    storage.ts      # File storage management
  index.ts          # Application entry point
/data/              # Temporary data storage and processing
/media/             # Course images and media files
/logs/              # Application logs with rotation
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
- `npm run validate:data` - Run data quality validation
- `npm run process:images` - Process and optimize course images
- `npm run generate:pages` - Generate SEO-optimized course pages
- `npm run monitor:health` - Check system health metrics

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

## Automation Schedules
- **Daily (2 AM)**: Weather updates via OpenWeather API, broken link checks
- **Weekly (Sunday 3 AM)**: Full data validation, Wikipedia content enhancement
- **Monthly (1st, 4 AM)**: Complete data refresh, OSM location updates, photo gallery updates

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

## Monitoring & Alerting
- **System Health**: CPU > 90%, Memory > 85% alerts
- **Database Performance**: Query time > 1000ms warnings
- **Automation Failures**: >20% failure rate alerts
- **API Status**: External service downtime notifications

## Image Processing Pipeline
- **Formats**: WebP (primary), JPEG (fallback), PNG (when needed)
- **Sizes**: SM (400px), MD (800px), LG (1200px), XL (1920px)
- **Optimization**: 85% quality, progressive JPEG
- **Alt Text**: Auto-generated with golf course context

## Performance Targets
- **Page Load**: <3 seconds for course detail pages
- **Core Web Vitals**: LCP <2.5s, FID <100ms, CLS <0.1
- **API Response**: <500ms for data queries
- **Batch Processing**: 100 courses in <2 hours

## File Organization
- Original images: `/media/courses/{courseId}/original/`
- Processed images: `/media/courses/{courseId}/optimized/`
- Temporary data: `/data/temp/` (auto-cleanup after 7 days)
- Reports: `/reports/` (archive monthly)

## Common Debugging Commands
- `npm run debug:scraper -- --course-id=123` - Debug specific course
- `npm run enrich:courses -- --name "Pebble Beach" --limit 1` - Test API enrichment for specific course
- `npm run enrich:courses -- --state CA --weather true --history false` - Weather-only enrichment for California
- `npm run logs:recent` - Show last 100 log entries
- `npm run health:check` - Quick system health verification
- `npm run validate:course -- --id=123` - Validate single course data

## Architecture Notes
- **Microservices Pattern**: Separate services for scraping, validation, image processing, API integration
- **API Integration**: 3 external APIs with centralized management, rate limiting, and circuit breakers
- **Smart Caching**: Node-cache with service-specific TTL (30min weather, 24hr Wikipedia/OSM)
- **Queue System**: Bull/Redis for batch job management (planned)
- **Database**: PostgreSQL with Prisma ORM, 8 models, 4 performance indexes
- **Logging**: Winston with daily rotation, category-specific loggers
- **Storage**: Automated directory management, course-specific organization
- **Error Handling**: 10 custom error types, circuit breaker, exponential backoff
- **Configuration**: Type-safe with Joi validation, comprehensive API settings
- **Data Quality**: 5 validator classes with cleaning and quality scoring
- **Horizontal Scaling**: Stateless services for easy scaling

## Emergency Procedures
- **Rate Limit Violations**: Automatically pause scraping for 1 hour
- **Database Connection Loss**: Retry with exponential backoff
- **Disk Space Critical**: Auto-cleanup temp files, alert administrators
- **API Quota Exceeded**: Switch to backup services, reduce frequency