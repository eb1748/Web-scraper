# Golf Journey Map - Web Scraper

Automated golf course data collection and management system with comprehensive infrastructure for web scraping, data validation, and SEO optimization.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd "Golf Journey Map/Web scraper"

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and API keys

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

## 📁 Project Structure

```
├── src/
│   ├── config/          # Configuration management
│   ├── models/          # Database models
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   │   ├── database.ts  # Database connection management
│   │   ├── errors.ts    # Error handling utilities
│   │   ├── logger.ts    # Winston logging system
│   │   └── storage.ts   # File storage management
│   ├── types/           # TypeScript type definitions
│   ├── scripts/         # Automation scripts
│   └── index.ts         # Application entry point
├── prisma/
│   └── schema.prisma    # Database schema
├── data/                # Data storage (git-ignored)
├── media/               # Media files (git-ignored)
└── logs/                # Application logs (git-ignored)
```

## 🔧 Configuration

The application uses environment variables for configuration. Key settings:

### Database
- `DATABASE_URL`: PostgreSQL connection string

### Scraping
- `SCRAPE_DELAY_MS`: Delay between requests (default: 2000ms)
- `MAX_CONCURRENT_REQUESTS`: Concurrent request limit (default: 3)
- `RETRY_ATTEMPTS`: Number of retry attempts (default: 5)

### APIs
- `OPENWEATHER_API_KEY`: OpenWeather API key (free tier)

### Validation
- `CONFIDENCE_THRESHOLD`: Minimum confidence score (default: 70)
- `QUALITY_SCORE_THRESHOLD`: Auto-approval threshold (default: 70)

## 📊 Database Schema

The system uses PostgreSQL with Prisma ORM. Key models:

### Course
Comprehensive golf course data including:
- Basic information (name, location, coordinates)
- Golf-specific data (yardage, ratings, par)
- Historical data (championships, events)
- Media content (images, maps)
- SEO metadata

### Supporting Models
- **Review**: User reviews and ratings
- **QualityReport**: Data quality assessments
- **ScrapingLog**: Scraping activity logs
- **Configuration**: System configuration
- **DataSource**: External data source management
- **ProcessingJob**: Job queue management

## 🛠️ Core Features

### 1. Database Management
- Connection pooling with retry logic
- Transaction support with automatic retries
- Health monitoring and maintenance tasks
- Graceful shutdown handling

### 2. Logging System
- Winston logger with daily rotation
- Category-specific logging (scraping, API, validation)
- Multiple log levels and formats
- Performance metrics tracking

### 3. Storage Management
- Automatic directory structure creation
- Course-specific media organization
- Temporary file cleanup
- Storage statistics monitoring

### 4. Error Handling
- Custom error hierarchy
- Circuit breaker pattern
- Exponential backoff retries
- Global error handlers

### 5. Configuration
- Type-safe configuration with validation
- Environment-based settings
- Hot-reload capability

## 📝 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build TypeScript

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:migrate:prod  # Production migrations
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio

# Testing
npm run test            # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests

# Code Quality
npm run lint            # ESLint with auto-fix
npm run format          # Prettier formatting
npm run typecheck       # TypeScript type checking

# Automation
npm run scrape:courses   # Run course scraping
npm run validate:data    # Validate all data
npm run process:images   # Process images
npm run generate:pages   # Generate SEO pages
npm run monitor:health   # Health check
```

## 🔒 Security

- No storage of personally identifiable information (PII)
- Environment variable validation
- SQL injection prevention via Prisma
- Rate limiting and circuit breaker patterns
- Secure error handling without exposing internals

## 📈 Monitoring

The system includes comprehensive monitoring:
- Database connection health
- Storage usage tracking
- API rate limit monitoring
- Error rate tracking
- Performance metrics

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Run linting and formatting before commits
5. Follow the established error handling patterns

## 📄 License

MIT

## 🚧 Next Steps

With PR1 complete, the infrastructure is ready for:
- PR2: Web scraping implementation
- PR3: API integrations
- PR4: Image processing pipeline
- PR5: Data validation system
- PR6: SEO page generation
- PR7: Automation scripts

## 💡 Development Tips

1. **Database**: Ensure PostgreSQL is running before starting the app
2. **Logs**: Check `./logs` directory for detailed debugging
3. **Storage**: Run `npm run monitor:health` to check system status
4. **Testing**: Use `npm run db:studio` to inspect database visually

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Verify connection string
npm run db:studio
```

### Permission Errors
```bash
# Ensure proper directory permissions
chmod -R 755 ./data ./media ./logs
```

### Module Resolution
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

Built with TypeScript, Prisma, and best practices for scalable web scraping.