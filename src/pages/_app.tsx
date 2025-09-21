import type { AppProps } from 'next/app';
import { DefaultSeo } from 'next-seo';
import { HelmetProvider } from 'react-helmet-async';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { SEOMonitor } from '../services/seo/seo-monitor';

// Default SEO configuration for the site
const defaultSEOConfig = {
  title: 'Golf Journey Map - Discover Premier Golf Courses',
  description: 'Explore the world\'s finest golf courses with detailed information, weather conditions, tee times, and booking options. Your comprehensive guide to golf course discovery.',
  canonical: 'https://golfjourney.com',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://golfjourney.com',
    siteName: 'Golf Journey Map',
    title: 'Golf Journey Map - Discover Premier Golf Courses',
    description: 'Explore the world\'s finest golf courses with detailed information, weather conditions, tee times, and booking options.',
    images: [
      {
        url: 'https://golfjourney.com/images/golf-journey-og.jpg',
        width: 1200,
        height: 630,
        alt: 'Golf Journey Map - Premium Golf Course Discovery Platform',
      },
    ],
  },
  twitter: {
    handle: '@golfjourneymap',
    site: '@golfjourneymap',
    cardType: 'summary_large_image',
  },
  additionalMetaTags: [
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, maximum-scale=5',
    },
    {
      name: 'theme-color',
      content: '#16a34a',
    },
    {
      name: 'apple-mobile-web-app-capable',
      content: 'yes',
    },
    {
      name: 'apple-mobile-web-app-status-bar-style',
      content: 'default',
    },
    {
      name: 'format-detection',
      content: 'telephone=no',
    },
    {
      name: 'keywords',
      content: 'golf courses, golf course directory, tee times, golf booking, golf course guide, golf travel, golf destinations',
    },
  ],
  additionalLinkTags: [
    {
      rel: 'icon',
      href: '/favicon.ico',
    },
    {
      rel: 'apple-touch-icon',
      href: '/apple-touch-icon.png',
      sizes: '180x180',
    },
    {
      rel: 'manifest',
      href: '/site.webmanifest',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossOrigin: 'anonymous',
    },
  ],
};

// Initialize SEO monitor
let seoMonitor: SEOMonitor | null = null;
if (typeof window !== 'undefined') {
  try {
    seoMonitor = new SEOMonitor({
      siteName: 'Golf Journey Map',
      siteUrl: 'https://golfjourney.com',
      defaultTitle: 'Golf Journey Map',
      defaultDescription: 'Discover Premier Golf Courses',
      defaultKeywords: ['golf', 'golf courses', 'tee times'],
      socialHandles: {
        twitter: '@golfjourneymap',
      },
      analytics: {
        googleAnalytics: process.env.NEXT_PUBLIC_GA_ID,
      },
      structuredData: {
        organization: {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Golf Journey Map',
          url: 'https://golfjourney.com',
          logo: 'https://golfjourney.com/images/logo.png',
          sameAs: [
            'https://twitter.com/golfjourneymap',
            'https://facebook.com/golfjourneymap',
            'https://instagram.com/golfjourneymap',
          ],
        },
      },
    });
  } catch (error) {
    console.error('Failed to initialize SEO monitor:', error);
  }
}

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Initialize Core Web Vitals monitoring
    if (seoMonitor && typeof window !== 'undefined') {
      seoMonitor.initializeCoreWebVitalsMonitoring();
    }

    // Track page views for analytics
    const handleRouteChange = (url: string) => {
      // Google Analytics page view tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
          page_path: url,
        });
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <HelmetProvider>
      <DefaultSeo {...defaultSEOConfig} />
      <Head>
        <meta charSet="utf-8" />
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          as="style"
          onLoad="this.onload=null;this.rel='stylesheet'"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          />
        </noscript>

        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://api.openweathermap.org" />
        <link rel="preconnect" href="https://en.wikipedia.org" />

        {/* DNS prefetch for performance */}
        <link rel="dns-prefetch" href="//www.google-analytics.com" />
        <link rel="dns-prefetch" href="//googletagmanager.com" />

        {/* Security headers */}
        <meta name="referrer" content="origin-when-cross-origin" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />

        {/* Google Analytics */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
      </Head>

      <Component {...pageProps} />
    </HelmetProvider>
  );
}

export default MyApp;