# PR 3: Free API Integrations (Weather, Wikipedia, OpenStreetMap)

*Integrate freely accessible APIs for weather data, historical information, and location services*

## 🎯 **Objective**

Implement integrations with free, publicly accessible APIs to enrich golf course data with weather information, historical details, and accurate location data.

## 🌤️ **Weather API Integration**

### **OpenWeather API (Free Tier)**

**Free Tier Limits**: 60 calls/minute, 1,000 calls/day
**Features**: Current weather, 5-day forecast, historical data

```typescript
// src/services/weather-service.ts
interface WeatherData {
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    conditions: string;
    visibility: number;
  };
  forecast: {
    date: string;
    tempHigh: number;
    tempLow: number;
    precipitation: number;
    conditions: string;
  }[];
}

class WeatherService {
  private apiKey: string;
  private baseUrl = 'https://api.openweathermap.org/data/2.5';

  async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    const response = await axios.get(`${this.baseUrl}/weather`, {
      params: {
        lat,
        lon,
        appid: this.apiKey,
        units: 'imperial',
      },
    });

    return this.formatWeatherData(response.data);
  }

  async get5DayForecast(lat: number, lon: number): Promise<WeatherData> {
    // Fetch 5-day forecast with 3-hour intervals
    // Format into daily summaries
    // Calculate precipitation probabilities
  }

  private formatWeatherData(rawData: any): WeatherData {
    // Transform API response to our interface
    // Handle missing or invalid data gracefully
    // Add golf-specific weather insights
  }
}
```

### **Weather Data Caching Strategy**

```typescript
// src/services/weather-cache.ts
class WeatherCache {
  private cache: Map<string, CachedWeather>;

  async getWeather(courseId: string, lat: number, lon: number): Promise<WeatherData> {
    const cacheKey = `${courseId}-${lat}-${lon}`;
    const cached = this.cache.get(cacheKey);

    // Use cached data if less than 30 minutes old
    if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      return cached.data;
    }

    // Fetch fresh data and cache it
    const weatherData = await this.weatherService.getCurrentWeather(lat, lon);
    this.cache.set(cacheKey, {
      data: weatherData,
      timestamp: Date.now(),
    });

    return weatherData;
  }
}
```

## 📚 **Wikipedia/Wikidata Integration**

### **Wikipedia API (Completely Free)**

```typescript
// src/services/wikipedia-service.ts
interface WikipediaData {
  summary: string;
  history: string;
  architect: string;
  openingYear: number;
  majorChampionships: string[];
  notableEvents: string[];
  references: string[];
}

class WikipediaService {
  private baseUrl = 'https://en.wikipedia.org/api/rest_v1';
  private wikidataUrl = 'https://www.wikidata.org/w/api.php';

  async searchCourseArticle(courseName: string, location: string): Promise<string | null> {
    // Search for course-specific Wikipedia articles
    // Use course name + location for better matching
    // Return article title if found, null otherwise

    const searchParams = {
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: `"${courseName}" golf course ${location}`,
      srlimit: 5,
    };

    const response = await axios.get(this.wikidataUrl, { params: searchParams });

    // Filter and validate search results
    // Return most relevant article title
  }

  async extractCourseData(articleTitle: string): Promise<WikipediaData> {
    // Fetch article content and infobox data
    // Extract structured information using regex and parsing
    // Cross-reference with Wikidata for additional structured data

    const [content, wikidata] = await Promise.all([
      this.getArticleContent(articleTitle),
      this.getWikidataInfo(articleTitle),
    ]);

    return this.combineWikipediaData(content, wikidata);
  }

  private async getArticleContent(title: string): Promise<string> {
    // Fetch Wikipedia article content
    // Extract relevant sections (history, design, tournaments)
    // Clean and format text content
  }

  private async getWikidataInfo(title: string): Promise<any> {
    // Fetch structured data from Wikidata
    // Extract architect, opening date, coordinates
    // Get tournament and championship data
  }
}
```

### **Historical Data Extraction**

```typescript
// src/services/course-history.ts
class CourseHistoryExtractor {
  async extractHistoricalData(courseName: string, location: string): Promise<HistoricalData> {
    // 1. Search Wikipedia for course article
    // 2. Extract opening year and architect information
    // 3. Find tournament and championship history
    // 4. Gather design and renovation details
    // 5. Collect notable moments and records

    const wikipediaData = await this.wikipediaService.extractCourseData(courseName, location);

    return {
      architect: this.extractArchitectInfo(wikipediaData),
      openingYear: this.extractOpeningYear(wikipediaData),
      majorChampionships: this.extractChampionships(wikipediaData),
      designPhilosophy: this.extractDesignInfo(wikipediaData),
      notableEvents: this.extractNotableEvents(wikipediaData),
    };
  }

  private extractArchitectInfo(data: WikipediaData): string {
    // Use regex and NLP to extract architect names
    // Handle multiple architects and renovation architects
    // Validate against known golf course architects
  }

  private extractChampionships(data: WikipediaData): string[] {
    // Identify major championships hosted
    // Extract years and tournament names
    // Validate against known golf championships
  }
}
```

## 🗺️ **OpenStreetMap/Overpass API Integration**

### **Location and Geographic Data (Free)**

```typescript
// src/services/osm-service.ts
interface OSMCourseData {
  coordinates: [number, number];
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  amenities: string[];
  nearbyFeatures: {
    hotels: POI[];
    restaurants: POI[];
    airports: POI[];
  };
}

class OSMService {
  private overpassUrl = 'https://overpass-api.de/api/interpreter';

  async findCourseLocation(courseName: string, city: string, state: string): Promise<OSMCourseData | null> {
    // Query Overpass API for golf course location
    // Search by name and location
    // Extract coordinates and address information

    const query = `
      [out:json];
      (
        way["leisure"="golf_course"]["name"~"${courseName}",i];
        relation["leisure"="golf_course"]["name"~"${courseName}",i];
      );
      out geom;
    `;

    const response = await axios.post(this.overpassUrl, query);
    return this.processCourseLocation(response.data);
  }

  async getNearbyAmenities(lat: number, lon: number, radiusKm: number = 10): Promise<POI[]> {
    // Find nearby hotels, restaurants, attractions
    // Query within specified radius
    // Return structured amenity data

    const query = `
      [out:json];
      (
        node["tourism"="hotel"](around:${radiusKm * 1000},${lat},${lon});
        node["amenity"="restaurant"](around:${radiusKm * 1000},${lat},${lon});
      );
      out;
    `;

    const response = await axios.post(this.overpassUrl, query);
    return this.processNearbyAmenities(response.data);
  }

  private processCourseLocation(osmData: any): OSMCourseData {
    // Extract course boundaries and center point
    // Parse address information from tags
    // Identify course amenities and features
  }
}
```

## 🎭 **Alternative Free APIs**

### **Backup Weather Services**
- **WeatherAPI.com**: 1M calls/month free
- **Visual Crossing**: 1000 records/day free
- **WeatherStack**: 1000 calls/month free

### **Geographic Services**
- **Nominatim (OpenStreetMap)**: Geocoding and reverse geocoding
- **GeoNames**: Geographic database with elevation data
- **MapBox (limited free tier)**: Geocoding with address formatting

### **Historical Data Sources**
- **Wikidata SPARQL**: Structured queries for golf course data
- **DBpedia**: Structured Wikipedia data extraction
- **Open Library**: Historical books and publications about courses

## 🔄 **API Management and Rate Limiting**

```typescript
// src/services/api-manager.ts
class APIManager {
  private rateLimiters: Map<string, RateLimiter>;

  constructor() {
    this.rateLimiters.set('openweather', new RateLimiter(60, 60000)); // 60/minute
    this.rateLimiters.set('wikipedia', new RateLimiter(200, 60000));  // 200/minute
    this.rateLimiters.set('overpass', new RateLimiter(10, 60000));    // 10/minute
  }

  async makeAPICall(service: string, requestFn: () => Promise<any>): Promise<any> {
    const limiter = this.rateLimiters.get(service);

    // Wait for rate limit availability
    await limiter.acquire();

    try {
      return await requestFn();
    } catch (error) {
      // Handle API errors and retries
      throw new APIError(service, error);
    }
  }
}
```

## 📋 **Acceptance Criteria**

- [ ] OpenWeather API integration functional with caching
- [ ] Wikipedia/Wikidata API integration working
- [ ] OpenStreetMap/Overpass API integration implemented
- [ ] Rate limiting system for all APIs
- [ ] Error handling and fallback mechanisms
- [ ] Data validation for all API responses
- [ ] Caching system to minimize API calls
- [ ] Configuration management for API keys
- [ ] Comprehensive logging for API usage

## 🔍 **Testing Requirements**

- API integration tests with mock responses
- Rate limiting compliance tests
- Error handling scenario tests
- Data validation and cleaning tests
- Cache functionality tests

## 📚 **Dependencies**

```bash
# API integration tools
npm install axios node-cache
npm install xml2js cheerio
npm install moment-timezone
```

## 🚀 **Expected Outcomes**

- Real-time weather data for all course locations
- Rich historical information from Wikipedia
- Accurate location and address data from OSM
- Reliable API integrations with proper error handling
- Cost-effective data enrichment using only free services
- Scalable system for ongoing data updates

This PR provides essential data enrichment capabilities using only freely accessible APIs, ensuring sustainable long-term operation without recurring costs.