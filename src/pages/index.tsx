import Head from 'next/head';
import { NextSeo } from 'next-seo';

export default function Home() {
  return (
    <>
      <NextSeo
        title="Golf Journey Map - Discover Premier Golf Courses"
        description="Explore the world's finest golf courses with detailed information, weather conditions, and booking options."
        canonical="https://golfjourney.com"
        openGraph={{
          type: 'website',
          locale: 'en_US',
          url: 'https://golfjourney.com',
          siteName: 'Golf Journey Map',
        }}
      />
      <Head>
        <title>Golf Journey Map - Discover Premier Golf Courses</title>
      </Head>

      <main>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Golf Journey Map</h1>
          <p>Discover Premier Golf Courses Worldwide</p>
          <p>Course detail pages and SEO system implementation in progress...</p>
        </div>
      </main>
    </>
  );
}