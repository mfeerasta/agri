import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@zameen/ui', '@zameen/locale', '@zameen/shared'],
};
export default config;
