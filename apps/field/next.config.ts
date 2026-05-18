import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https?.*\/api\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 6,
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: /\/icons\/.*\.(png|svg|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'icons',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: /\/(attendance|tasks|diesel|repair|harvest|issuance|livestock|photos|profile)/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'app-shell' },
    },
    {
      urlPattern: /\/$/,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'app-home' },
    },
  ],
});

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: [
    '@zameen/ui',
    '@zameen/locale',
    '@zameen/shared',
    '@zameen/db',
    '@zameen/approvals',
    '@zameen/finance',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
    deviceSizes: [320, 480, 640, 768, 1024],
    imageSizes: [16, 32, 64, 96, 128, 200],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [{ key: 'Service-Worker-Allowed', value: '/' }],
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default withBundleAnalyzer(withPWA(config as any));
