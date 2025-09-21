/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  webpack(config) {
    // Enable source maps in development
    if (process.env.NODE_ENV === 'development') {
      config.devtool = 'cheap-module-source-map';
    }
    return config;
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  // Asset optimization
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // SEO and routing
  trailingSlash: false,
  generateEtags: false,
  // For static site generation
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
};

module.exports = withBundleAnalyzer(nextConfig);