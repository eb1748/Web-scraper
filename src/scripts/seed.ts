import { PrismaClient } from '@prisma/client';
import { systemLogger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Seed the database with initial data
 */
async function seed(): Promise<void> {
  try {
    systemLogger.info('Starting database seed');

    // Create sample configuration entries
    await prisma.configuration.upsert({
      where: { key: 'scraping_enabled' },
      update: {},
      create: {
        key: 'scraping_enabled',
        value: true,
        description: 'Global flag to enable/disable scraping operations',
      },
    });

    await prisma.configuration.upsert({
      where: { key: 'max_courses_per_batch' },
      update: {},
      create: {
        key: 'max_courses_per_batch',
        value: 10,
        description: 'Maximum number of courses to process in a single batch',
      },
    });

    // Create sample data sources
    await prisma.dataSource.upsert({
      where: { name: 'OpenWeather' },
      update: {},
      create: {
        name: 'OpenWeather',
        type: 'API',
        baseUrl: 'https://api.openweathermap.org/data/2.5',
        rateLimit: 60,
        isActive: true,
        reliability: 0.95,
      },
    });

    await prisma.dataSource.upsert({
      where: { name: 'Wikipedia' },
      update: {},
      create: {
        name: 'Wikipedia',
        type: 'API',
        baseUrl: 'https://en.wikipedia.org/api/rest_v1',
        rateLimit: 200,
        isActive: true,
        reliability: 0.98,
      },
    });

    await prisma.dataSource.upsert({
      where: { name: 'OpenStreetMap' },
      update: {},
      create: {
        name: 'OpenStreetMap',
        type: 'API',
        baseUrl: 'https://overpass-api.de/api',
        rateLimit: 10,
        isActive: true,
        reliability: 0.92,
      },
    });

    // Create a sample course (Pebble Beach)
    const sampleCourse = await prisma.course.upsert({
      where: { id: 'sample-pebble-beach' },
      update: {},
      create: {
        id: 'sample-pebble-beach',
        name: 'Pebble Beach Golf Links',
        location: 'Pebble Beach, California, USA',
        latitude: 36.5668,
        longitude: -121.9495,
        description: 'One of the most famous golf courses in the world, known for its stunning ocean views.',
        architect: 'Jack Neville and Douglas Grant',
        openingYear: 1919,
        courseType: 'LINKS',
        totalYardage: 6828,
        courseRating: 75.5,
        slopeRating: 145,
        parScore: 72,
        numberOfHoles: 18,
        majorChampionships: ['U.S. Open'],
        website: 'https://www.pebblebeach.com',
        publicAccess: true,
        greensFeePriceRange: '$500-600',
        keywords: ['pebble beach', 'golf', 'california', 'ocean views'],
        dataSources: ['manual_seed'],
        dataSourceConfidence: 100,
      },
    });

    // Create a sample quality report for the course
    await prisma.qualityReport.create({
      data: {
        courseId: sampleCourse.id,
        completenessScore: 85,
        accuracyScore: 90,
        consistencyScore: 88,
        freshnessScore: 95,
        reliabilityScore: 92,
        overallScore: 90,
        issues: {
          minor: ['Missing some historical tournament data'],
        },
        recommendations: ['Add more gallery images', 'Update seasonal pricing'],
        manualReviewRequired: false,
        confidenceLevel: 'high',
      },
    });

    systemLogger.info('Database seed completed successfully');

    // Log summary
    const coursesCount = await prisma.course.count();
    const dataSourcesCount = await prisma.dataSource.count();
    const configCount = await prisma.configuration.count();

    systemLogger.info(`Seed summary: ${coursesCount} courses, ${dataSourcesCount} data sources, ${configCount} configurations`);

  } catch (error) {
    systemLogger.error('Database seed failed', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

export default seed;