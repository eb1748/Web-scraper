import { Html, Head, Main, NextScript } from 'next/document';
import Document, { DocumentContext, DocumentInitialProps } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
    const initialProps = await Document.getInitialProps(ctx);
    return initialProps;
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Essential meta tags for SEO */}
          <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
          <meta name="googlebot" content="index, follow" />
          <meta name="bingbot" content="index, follow" />

          {/* Favicon and touch icons */}
          <link rel="icon" type="image/x-icon" href="/favicon.ico" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#16a34a" />

          {/* Web App Manifest */}
          <link rel="manifest" href="/site.webmanifest" />
          <meta name="msapplication-TileColor" content="#16a34a" />
          <meta name="msapplication-config" content="/browserconfig.xml" />

          {/* Performance optimizations */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://api.openweathermap.org" />
          <link rel="preconnect" href="https://en.wikipedia.org" />
          <link rel="preconnect" href="https://overpass-api.de" />

          {/* DNS prefetch for external services */}
          <link rel="dns-prefetch" href="//www.google-analytics.com" />
          <link rel="dns-prefetch" href="//googletagmanager.com" />
          <link rel="dns-prefetch" href="//cdnjs.cloudflare.com" />

          {/* Structured Data for Organization */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Golf Journey Map',
                url: 'https://golfjourney.com',
                logo: {
                  '@type': 'ImageObject',
                  url: 'https://golfjourney.com/images/logo.png',
                  width: 512,
                  height: 512
                },
                description: 'The premier platform for discovering exceptional golf courses worldwide with comprehensive course information, weather data, and booking services.',
                foundingDate: '2024',
                sameAs: [
                  'https://twitter.com/golfjourneymap',
                  'https://facebook.com/golfjourneymap',
                  'https://instagram.com/golfjourneymap'
                ],
                contactPoint: {
                  '@type': 'ContactPoint',
                  contactType: 'customer service',
                  availableLanguage: 'English'
                },
                areaServed: {
                  '@type': 'Country',
                  name: 'United States'
                },
                knowsAbout: [
                  'Golf Courses',
                  'Golf Course Architecture',
                  'Golf Tourism',
                  'Tee Time Booking',
                  'Golf Course Weather',
                  'Golf Course Reviews'
                ]
              })
            }}
          />

          {/* Website Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'Golf Journey Map',
                url: 'https://golfjourney.com',
                description: 'Discover premier golf courses with detailed information, weather conditions, and booking options.',
                inLanguage: 'en-US',
                copyrightYear: new Date().getFullYear(),
                author: {
                  '@type': 'Organization',
                  name: 'Golf Journey Map'
                },
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: 'https://golfjourney.com/search?q={search_term_string}'
                  },
                  'query-input': 'required name=search_term_string'
                }
              })
            }}
          />

          {/* Critical CSS inlining placeholder */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
                /* Critical CSS for initial render */
                * {
                  box-sizing: border-box;
                }
                body {
                  margin: 0;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                  -webkit-font-smoothing: antialiased;
                  -moz-osx-font-smoothing: grayscale;
                  line-height: 1.6;
                  color: #333;
                }
                .loading-skeleton {
                  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                  background-size: 200% 100%;
                  animation: loading 1.5s infinite;
                }
                @keyframes loading {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
                .sr-only {
                  position: absolute;
                  width: 1px;
                  height: 1px;
                  padding: 0;
                  margin: -1px;
                  overflow: hidden;
                  clip: rect(0, 0, 0, 0);
                  white-space: nowrap;
                  border: 0;
                }
              `
            }}
          />

          {/* Performance monitoring */}
          {process.env.NODE_ENV === 'production' && (
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  // Performance monitoring
                  if ('performance' in window && 'PerformanceObserver' in window) {
                    try {
                      const observer = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        entries.forEach((entry) => {
                          if (entry.entryType === 'largest-contentful-paint') {
                            console.log('LCP:', entry.startTime);
                          }
                          if (entry.entryType === 'first-input') {
                            console.log('FID:', entry.processingStart - entry.startTime);
                          }
                          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
                            console.log('CLS:', entry.value);
                          }
                        });
                      });

                      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
                    } catch (e) {
                      console.error('Performance monitoring failed:', e);
                    }
                  }
                `
              }}
            />
          )}

          {/* Resource hints for better performance */}
          <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

          {/* Service Worker registration */}
          {process.env.NODE_ENV === 'production' && (
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', function() {
                      navigator.serviceWorker.register('/sw.js')
                        .then(function(registration) {
                          console.log('SW registered: ', registration);
                        })
                        .catch(function(registrationError) {
                          console.log('SW registration failed: ', registrationError);
                        });
                    });
                  }
                `
              }}
            />
          )}
        </Head>
        <body>
          {/* Skip to content link for accessibility */}
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-blue-600 text-white p-4 z-50">
            Skip to main content
          </a>

          {/* No-JS fallback */}
          <noscript>
            <div style={{
              padding: '20px',
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '4px',
              margin: '20px',
              textAlign: 'center',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              <strong>JavaScript Required:</strong> This application requires JavaScript to function properly.
              Please enable JavaScript in your browser and refresh the page.
            </div>
          </noscript>

          <Main />
          <NextScript />

          {/* Structured data injection point for dynamic content */}
          <div id="structured-data-root" style={{ display: 'none' }}></div>
        </body>
      </Html>
    );
  }
}

export default MyDocument;