import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@zameen/ui', '@zameen/locale', '@zameen/shared', '@zameen/approvals', '@zameen/finance'],
  experimental: { typedRoutes: true },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};

export default config;
