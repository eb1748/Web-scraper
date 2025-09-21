import type { AutomatedCourseDetails } from './quality.types';
import type { WeatherData, OSMCourseData } from './api.types';

// Core SEO metadata interfaces
export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  breadcrumbs: Breadcrumb[];
  structuredData: StructuredDataSchema;
}

export interface Breadcrumb {
  name: string;
  url: string;
  position: number;
}

// Structured data schema types
export interface StructuredDataSchema {
  golfCourse: GolfCourseSchema;
  breadcrumb: BreadcrumbSchema;
  organization?: OrganizationSchema;
}

export interface GolfCourseSchema {
  '@context': string;
  '@type': 'GolfCourse';
  name: string;
  description?: string;
  address: PostalAddress;
  geo: GeoCoordinates;
  telephone?: string;
  url?: string;
  image?: string;
  architect?: string;
  dateOpened?: string;
  amenityFeature: LocationFeatureSpecification[];
  priceRange?: string;
  aggregateRating?: AggregateRating;
  potentialAction?: ReserveAction;
}

export interface PostalAddress {
  '@type': 'PostalAddress';
  addressLocality: string;
  addressRegion: string;
  addressCountry: string;
  streetAddress?: string;
  postalCode?: string;
}

export interface GeoCoordinates {
  '@type': 'GeoCoordinates';
  latitude: number;
  longitude: number;
}

export interface LocationFeatureSpecification {
  '@type': 'LocationFeatureSpecification';
  name: string;
  value: string | number;
}

export interface AggregateRating {
  '@type': 'AggregateRating';
  ratingValue: number;
  ratingCount: number;
  bestRating?: number;
  worstRating?: number;
}

export interface ReserveAction {
  '@type': 'ReserveAction';
  target: EntryPoint;
  result: Reservation;
}

export interface EntryPoint {
  '@type': 'EntryPoint';
  urlTemplate: string;
  inLanguage: string;
}

export interface Reservation {
  '@type': 'Reservation';
  '@id': string;
}

export interface BreadcrumbSchema {
  '@context': string;
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItem[];
}

export interface BreadcrumbItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
}

export interface OrganizationSchema {
  '@context': string;
  '@type': 'Organization';
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}

// Social media meta tag types
export interface SocialMetaTags {
  openGraph: OpenGraphTags;
  twitter: TwitterTags;
  facebook?: FacebookTags;
}

export interface OpenGraphTags {
  'og:title': string;
  'og:description': string;
  'og:image': string;
  'og:image:width': string;
  'og:image:height': string;
  'og:type': string;
  'og:url': string;
  'og:site_name': string;
  'place:location:latitude'?: string;
  'place:location:longitude'?: string;
  'business:contact_data:street_address'?: string;
  'business:contact_data:website'?: string;
  'business:contact_data:phone_number'?: string;
}

export interface TwitterTags {
  'twitter:card': 'summary' | 'summary_large_image' | 'app' | 'player';
  'twitter:title': string;
  'twitter:description': string;
  'twitter:image': string;
  'twitter:image:alt': string;
  'twitter:site'?: string;
  'twitter:creator'?: string;
}

export interface FacebookTags {
  'fb:app_id'?: string;
  'fb:admins'?: string;
}

// Content optimization types
export interface OptimizedContent {
  heroSection: HeroContent;
  aboutSection: AboutContent;
  historySection: HistoryContent;
  featuresSection: FeaturesContent;
  locationSection: LocationContent;
}

export interface HeroContent {
  headline: string;
  subheadline: string;
  callToAction: string;
  weatherWidget: boolean;
  keyHighlights: string[];
}

export interface AboutContent {
  description: string;
  quickFacts: QuickFact[];
  highlights: string[];
}

export interface QuickFact {
  label: string;
  value: string;
  icon?: string;
}

export interface HistoryContent {
  summary: string;
  timeline: TimelineEvent[];
  notableEvents: string[];
}

export interface TimelineEvent {
  year: number;
  event: string;
  description?: string;
}

export interface FeaturesContent {
  overview: string;
  specifications: CourseSpecification[];
  amenities: AmenityFeature[];
}

export interface CourseSpecification {
  name: string;
  value: string | number;
  unit?: string;
}

export interface AmenityFeature {
  name: string;
  description?: string;
  available: boolean;
  icon?: string;
}

export interface LocationContent {
  summary: string;
  nearbyAttractions: NearbyAttraction[];
  directions: DirectionInfo;
}

export interface NearbyAttraction {
  name: string;
  type: string;
  distance: string;
  description?: string;
}

export interface DirectionInfo {
  address: string;
  coordinates: [number, number];
  drivingDirections?: string;
  publicTransport?: string;
}

// SEO performance and monitoring types
export interface SEOMetrics {
  pageLoadSpeed: number;
  coreWebVitals: CoreWebVitals;
  structuredDataValidation: boolean;
  mobileUsability: boolean;
  indexabilityScore: number;
  lastAnalyzed: Date;
}

export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

// URL generation types
export interface URLStructure {
  courseUrl: string;
  canonicalUrl: string;
  stateUrl: string;
  cityUrl: string;
  breadcrumbUrls: string[];
}

// Page generation types
export interface CoursePageProps {
  courseData: AutomatedCourseDetails;
  weatherData?: WeatherData;
  nearbyAmenities: POI[];
  seoMetadata: SEOMetadata;
  optimizedContent: OptimizedContent;
  socialMetaTags: SocialMetaTags;
}

export interface POI {
  id: string;
  name: string;
  type: 'restaurant' | 'hotel' | 'attraction' | 'shopping' | 'gas_station' | 'hospital';
  distance: number;
  coordinates: [number, number];
  address?: string;
  rating?: number;
  description?: string;
}

// Content enhancement types
export interface ContentEnhancementOptions {
  includeWeather: boolean;
  includeHistory: boolean;
  includeNearbyAmenities: boolean;
  optimizeForKeywords: boolean;
  generateAltText: boolean;
  minContentLength: number;
  maxContentLength: number;
}

export interface SEOConfiguration {
  siteName: string;
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultKeywords: string[];
  socialHandles: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  analytics: {
    googleAnalytics?: string;
    googleTagManager?: string;
  };
  structuredData: {
    organization: OrganizationSchema;
  };
}

// Validation and quality types
export interface SEOValidationResult {
  isValid: boolean;
  score: number;
  issues: SEOIssue[];
  recommendations: SEORecommendation[];
}

export interface SEOIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
}

export interface SEORecommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  description: string;
  estimatedImpact: string;
}

// Export type for course page generation
export interface GeneratedCoursePage {
  slug: string;
  filePath: string;
  props: CoursePageProps;
  metadata: SEOMetadata;
  performance: {
    generationTime: number;
    fileSize: number;
    imageCount: number;
  };
}