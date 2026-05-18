import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@zameen/ui', '@zameen/locale', '@zameen/shared', '@zameen/approvals'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
    deviceSizes: [320, 480, 640, 768, 1024],
    imageSizes: [16, 32, 64, 96, 128, 200],
  },
};

export default withBundleAnalyzer(config);
