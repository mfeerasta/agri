import type { MetadataRoute } from 'next';

const BASE = 'https://agri.feerasta.ai';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = ['', '/features', '/about', '/contact', '/privacy', '/terms', '/api/docs'];
  return routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: path === '' ? 1.0 : 0.6,
  }));
}
