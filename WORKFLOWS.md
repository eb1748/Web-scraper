# Golf Journey Map - Workflow Examples

Complete guide to using the Golf Journey Map Web Scraper with practical examples and real-world scenarios.

## 🚀 Quick Start Workflows

### Initial Setup Workflow
Complete setup from scratch to running system.

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your settings

# 3. Initialize database
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Start development server
npm run dev
```

**Expected Output**: System starts with database connected and logs showing "Ready to start scraping operations"

**Verification**:
```bash
# Check database connection
npm run db:studio
# Opens GUI at http://localhost:5555

# Check system health
npm run automation:health
```

---

## 📊 Data Collection Workflows

### 1. Basic Course Scraping Workflow

**When to use**: When you have courses in the database that need website data extracted.

```bash
# Step 1: Check what courses need scraping
npm run db:studio
# Look for courses with missing website or description fields

# Step 2: Add a course that needs scraping (example)
psql -d golf_journey_scraper -c "
INSERT INTO \"Course\" (id, name, location, latitude, longitude)
VALUES ('test-course-2', 'St Andrews Old Course', 'St Andrews, Scotland', 56.3467, -2.8050);"

# Step 3: Run the scraper
npm run scrape:courses

# Step 4: Monitor logs
tail -f logs/app-$(date +%Y-%m-%d).log
```

**Success Indicators**:
- Log shows "Found X courses to scrape"
- Progress tracking: "Progress: 100% (X/X)"
- Database updated with extracted data

### 2. API Enrichment Workflow

**When to use**: Enhance existing course data with weather, historical, and location information.

#### Basic Enrichment
```bash
# Enrich all courses with all available APIs
npm run enrich:courses

# Enrich specific state only
npm run enrich:courses -- --state CA --limit 5

# Weather data only
npm run enrich:courses -- --weather true --history false --location false
```

#### Advanced Enrichment Examples
```bash
# Enrich specific course by name
npm run enrich:courses -- --name "Pebble Beach" --limit 1

# Batch enrichment with quality control
npm run enrich:courses -- --batch-size 5 --min-quality 80 --validate-results true

# Skip existing data and process new courses only
npm run enrich:courses -- --skip-existing true --limit 20
```

**Success Indicators**:
- Weather data populated (current conditions + 3-day forecast)
- Historical data added (architect, opening year, championships)
- Location data enhanced (nearby amenities, precise coordinates)

### 3. Image Processing Workflow

**When to use**: Download, optimize, and enhance course images for web display.

#### Single Course Image Processing
```bash
# Process images for specific course
npm run process:images -- \
  --course-id "pebble-beach" \
  --course-name "Pebble Beach Golf Links" \
  --images "https://example.com/image1.jpg,https://example.com/image2.jpg" \
  --enhance \
  --thumbnails

# Process with validation disabled (faster)
npm run process:images -- \
  --course-id "test-course" \
  --course-name "Test Course" \
  --images "url1,url2" \
  --skip-validation
```

#### Batch Image Processing
```bash
# Create batch file (data/courses.json)
echo '[
  {
    "courseId": "course-1",
    "courseName": "Augusta National",
    "images": ["https://example.com/augusta1.jpg", "https://example.com/augusta2.jpg"]
  },
  {
    "courseId": "course-2",
    "courseName": "St Andrews",
    "images": ["https://example.com/standrews1.jpg"]
  }
]' > data/courses.json

# Process batch
npm run process:images -- --batch-file "./data/courses.json"
```

**Expected File Structure**:
```
media/courses/{courseId}/
├── original/           # Downloaded source images
├── optimized/          # Multi-format processed variants
│   ├── hero/          # Main course hero images
│   ├── gallery/       # Photo gallery images
│   ├── maps/          # Course layout images
│   └── amenities/     # Facility photos
├── thumbnails/        # Small preview images
└── metadata.json      # Image metadata and alt text
```

---

## 🔍 Data Quality & Validation Workflows

### 1. Quality Assessment Workflow

**When to use**: Evaluate and improve data quality before publishing.

```bash
# Run quality demo to see system capabilities
npm run quality:demo

# Assess specific course data quality
npm run validate:course -- --id="pebble-beach" --enhance

# Generate comprehensive quality report
npm run quality:report -- --timeframe=weekly
```

#### Manual Quality Assessment (via code)
```bash
# Start development server for API access
npm run dev

# In another terminal, run custom quality checks
node -e "
const { qualitySystem } = require('./dist/services/quality-system.js');

async function checkQuality() {
  const courseData = await prisma.course.findFirst();
  const assessment = await qualitySystem.assessQuality(courseData);
  console.log('Quality Score:', assessment.metrics.overallScore);
  console.log('Issues:', assessment.issues);
  console.log('Recommendations:', assessment.recommendations);
}

checkQuality();
"
```

### 2. Data Enhancement Workflow

**When to use**: Automatically improve data quality using smart inference.

```bash
# Full data validation and enhancement
npm run validate:data

# Enhanced workflow with custom settings
node -e "
const { qualitySystem } = require('./dist/services/quality-system.js');

async function enhanceAllCourses() {
  const courses = await prisma.course.findMany();
  const results = await qualitySystem.batchProcess(courses, {
    enhanceData: true,
    validateResults: true,
    minQualityScore: 75
  });

  console.log('Enhanced:', results.successful);
  console.log('Failed:', results.failed);
  console.log('Average Score Improvement:', results.averageImprovement);
}

enhanceAllCourses();
"
```

**Quality Metrics**:
- **Completeness**: 75%+ required for publication
- **Accuracy**: Format validation and data verification
- **Consistency**: Cross-field validation
- **Reliability**: Source trustworthiness
- **Freshness**: Data age and update frequency

---

## 🌐 SEO & Frontend Workflows

### 1. Page Generation Workflow

**When to use**: Generate SEO-optimized course detail pages for the website.

```bash
# Generate pages for all courses
npm run generate:pages

# Generate for specific state
npm run generate:pages -- --state="California"

# Generate with custom options
npm run generate:pages -- --validate-seo --optimize-images
```

### 2. SEO Development Workflow

```bash
# Start Next.js development server
npm run dev:frontend
# Visit http://localhost:3000

# Build production version
npm run build:next

# Validate SEO compliance
npm run validate:seo

# Run SEO tests
npm run test:seo
```

### 3. Frontend Development Workflow

```bash
# Start backend and frontend simultaneously
npm run dev &        # Backend API
npm run dev:next &    # Frontend server

# Monitor both logs
tail -f logs/app-$(date +%Y-%m-%d).log &
npm run dev:next 2>&1 | grep -E "(error|warn|info)"
```

**Performance Targets**:
- Page Load: <3 seconds
- Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1
- SEO Score: 95+ Google PageSpeed Insights

---

## 🤖 Automation & Maintenance Workflows

### 1. Master Automation Workflow

**When to use**: Run complete end-to-end data collection and processing.

```bash
# Full automation with all services
npm run automation:run

# Monitor automation progress
npm run automation:progress

# Check system health during automation
npm run automation:health
```

### 2. Scheduled Maintenance Workflows

#### Daily Tasks
```bash
# Update weather data for all courses
npm run scheduled:weather

# Alternative: state-specific weather updates
./scripts/update-weather-data.sh --state=CA --limit=50

# Alternative: all courses
./scripts/update-weather-data.sh --all-courses
```

#### Weekly Tasks
```bash
# Comprehensive data validation
npm run scheduled:validate

# Alternative: manual weekly validation
./scripts/validate-all-data.sh --generate-report --fix-issues
```

#### Monthly Tasks
```bash
# Complete system refresh and maintenance
npm run scheduled:monthly

# Alternative: manual monthly maintenance
./scripts/monthly-automation.sh --full-refresh --optimize-db

# Database maintenance only
npm run maintenance:database --retention-days=30

# File system cleanup only
npm run maintenance:filesystem --retention-days=30
```

### 3. Health Monitoring Workflow

```bash
# Real-time system monitoring
npm run automation:health

# Quick maintenance tasks
npm run maintenance:quick

# Full system maintenance
npm run maintenance:full
```

**Health Check Indicators**:
- CPU usage < 90%
- Memory usage < 85%
- Database query time < 1000ms
- API response time < 500ms
- Automation success rate > 95%

---

## 🔧 Troubleshooting Workflows

### 1. Debug Scraping Issues

**Problem**: Scraping fails or returns no data

```bash
# Check what courses are targeted for scraping
psql -d golf_journey_scraper -c "
SELECT id, name, website, last_updated
FROM \"Course\"
WHERE website IS NULL
   OR last_updated < NOW() - INTERVAL '7 days'
   OR description IS NULL;"

# Add a test course for scraping
psql -d golf_journey_scraper -c "
INSERT INTO \"Course\" (id, name, location, latitude, longitude)
VALUES ('debug-course', 'Debug Golf Course', 'Debug City, State', 40.0, -74.0);"

# Run scraper with detailed logging
LOG_LEVEL=debug npm run scrape:courses

# Check specific logs
tail -f logs/app-$(date +%Y-%m-%d).log | grep -E "(error|scraping)"
```

### 2. Debug API Integration Issues

**Problem**: API enrichment fails

```bash
# Check API health individually
npm run automation:health

# Test weather API specifically
node -e "
const { WeatherService } = require('./dist/services/weather/weather-service.js');
const weather = new WeatherService();

async function testWeather() {
  try {
    const data = await weather.getCurrentWeather(36.5668, -121.9495);
    console.log('Weather API working:', data.current.condition);
  } catch (error) {
    console.error('Weather API error:', error.message);
  }
}

testWeather();
"

# Test with specific course
npm run enrich:courses -- --name "Pebble Beach" --limit 1 --weather true --history false
```

### 3. Debug Database Issues

**Problem**: Database connection or query issues

```bash
# Check database connection
npm run db:studio
# Should open GUI at http://localhost:5555

# Verify database structure
psql -d golf_journey_scraper -c "\dt"

# Check course data
psql -d golf_journey_scraper -c "SELECT COUNT(*) FROM \"Course\";"

# Reset database if needed
npm run db:migrate:reset
npm run db:seed
```

### 4. Debug Image Processing Issues

**Problem**: Image processing fails

```bash
# Test with single image
npm run process:images -- \
  --course-id "test" \
  --course-name "Test Course" \
  --images "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Pebble_Beach_Golf_Links_Hole_7.jpg/800px-Pebble_Beach_Golf_Links_Hole_7.jpg" \
  --skip-validation

# Check storage directories
ls -la media/courses/

# Verify image processing capabilities
node -e "
const sharp = require('sharp');
console.log('Sharp version:', sharp.versions);
"
```

### 5. Performance Investigation Workflow

**Problem**: System running slowly

```bash
# Check system resources
npm run automation:health

# Monitor database performance
psql -d golf_journey_scraper -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;"

# Check log files for errors
grep -E "(error|timeout|failed)" logs/app-$(date +%Y-%m-%d).log | tail -20

# Clean up old data
npm run maintenance:database
npm run maintenance:filesystem
```

---

## 📈 Advanced Workflows

### 1. Production Deployment Workflow

```bash
# 1. Pre-deployment checks
npm run test
npm run lint
npm run typecheck

# 2. Build for production
npm run build

# 3. Database migration (production)
npm run db:migrate:prod

# 4. Start production services
npm run start &
npm run start:next &

# 5. Verify deployment
curl -f http://localhost:3000/health || exit 1
```

### 2. Data Export Workflow

```bash
# Export course data
psql -d golf_journey_scraper -c "
COPY (
  SELECT id, name, location, latitude, longitude, description, website
  FROM \"Course\"
  WHERE public_access = true
) TO '/tmp/courses_export.csv' WITH CSV HEADER;"

# Export quality reports
psql -d golf_journey_scraper -c "
COPY (
  SELECT c.name, qr.overall_score, qr.completeness_score, qr.created_at
  FROM \"QualityReport\" qr
  JOIN \"Course\" c ON c.id = qr.course_id
  ORDER BY qr.created_at DESC
) TO '/tmp/quality_export.csv' WITH CSV HEADER;"
```

### 3. Bulk Data Import Workflow

```bash
# Prepare import file (courses.csv)
echo "id,name,location,latitude,longitude,website
course-001,Example Golf Club,Example City,40.0,-74.0,https://example.com
course-002,Another Golf Course,Another City,41.0,-75.0,https://another.com" > courses.csv

# Import via psql
psql -d golf_journey_scraper -c "
COPY \"Course\" (id, name, location, latitude, longitude, website)
FROM '/path/to/courses.csv'
WITH CSV HEADER;"

# Run enrichment on new courses
npm run enrich:courses -- --skip-existing false --limit 100
```

---

## 🎯 Best Practices

### Development Workflow
1. **Always run `npm run db:studio`** to visualize data changes
2. **Monitor logs** with `tail -f logs/app-$(date +%Y-%m-%d).log`
3. **Test with small datasets** before running large batches
4. **Use quality demo** to understand system capabilities: `npm run quality:demo`

### Production Workflow
1. **Schedule regular maintenance**: Daily weather, weekly validation, monthly cleanup
2. **Monitor system health**: Set up alerts for CPU/memory/disk usage
3. **Backup database regularly**: Use automated backup scripts
4. **Track API usage**: Monitor rate limits and quotas

### Debugging Workflow
1. **Start with health checks**: `npm run automation:health`
2. **Check recent logs**: Look for errors in the last 24 hours
3. **Isolate the problem**: Test individual components
4. **Use manual verification**: Check data in database GUI

---

## 📚 Additional Resources

- **Database GUI**: `npm run db:studio` → http://localhost:5555
- **System Logs**: `./logs/app-YYYY-MM-DD.log`
- **Configuration**: `.env` file and `src/config/config.ts`
- **API Documentation**: Type definitions in `src/types/`
- **Architecture**: See `CLAUDE.md` for detailed system overview

## 🆘 Quick Help

```bash
# Get help for specific scripts
npm run enrich:courses -- --help
npm run process:images -- --help

# Check all available scripts
npm run

# View database schema
npm run db:studio

# Check system status
npm run automation:health
```