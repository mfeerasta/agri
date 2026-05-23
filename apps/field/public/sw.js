/* Zameen Field service worker. Handles Web Push + offline asset caching.
 *
 * Caching strategy:
 *   - Cache-first for R2-hosted photos and documents (*.r2.dev), bounded to
 *     a 100MB LRU with a 7-day max age. Lets field workers see their last
 *     diesel receipt or sign-off photo even on a flaky connection.
 *   - Stale-while-revalidate for mapbox tile/style endpoints so the field
 *     map opens instantly while a fresh tile downloads in the background.
 *   - Network-first default; Workbox or next-pwa can layer additional rules
 *     later without conflicting with the handlers below.
 */
/* eslint-disable no-restricted-globals */

const R2_CACHE = 'zameen-field-r2-v1';
const MAPBOX_CACHE = 'zameen-field-mapbox-v1';
const R2_MAX_BYTES = 100 * 1024 * 1024;
const R2_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

importScripts('/sw-push.js');

function isR2Host(url) {
  return /\.r2\.dev$/i.test(url.hostname) || /\.r2\.cloudflarestorage\.com$/i.test(url.hostname);
}

function isMapboxHost(url) {
  return /(?:^|\.)mapbox\.com$/i.test(url.hostname) || /tiles\.mapbox/i.test(url.hostname);
}

function dateFromHeaders(headers) {
  const stamp = headers.get('x-zameen-cached-at');
  return stamp ? Number.parseInt(stamp, 10) : 0;
}

async function trimCache(cacheName, maxBytes) {
  const cache = await caches.open(cacheName);
  const entries = await cache.keys();
  if (entries.length === 0) return;
  let totalBytes = 0;
  const sized = [];
  for (const req of entries) {
    const res = await cache.match(req);
    if (!res) continue;
    const len = Number.parseInt(res.headers.get('content-length') ?? '0', 10);
    const bytes = Number.isFinite(len) && len > 0 ? len : 50 * 1024;
    totalBytes += bytes;
    sized.push({ req, cachedAt: dateFromHeaders(res.headers), bytes });
  }
  if (totalBytes <= maxBytes) return;
  sized.sort((a, b) => a.cachedAt - b.cachedAt);
  while (totalBytes > maxBytes && sized.length > 0) {
    const oldest = sized.shift();
    if (!oldest) break;
    await cache.delete(oldest.req);
    totalBytes -= oldest.bytes;
  }
}

async function withCachedAtHeader(res) {
  const headers = new Headers(res.headers);
  headers.set('x-zameen-cached-at', String(Date.now()));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function cacheFirstR2(event) {
  const cache = await caches.open(R2_CACHE);
  const cached = await cache.match(event.request);
  if (cached) {
    const cachedAt = dateFromHeaders(cached.headers);
    if (cachedAt && Date.now() - cachedAt < R2_MAX_AGE_MS) {
      return cached;
    }
    await cache.delete(event.request);
  }
  try {
    const res = await fetch(event.request);
    if (res.ok) {
      const stamped = await withCachedAtHeader(res.clone());
      await cache.put(event.request, stamped);
      event.waitUntil(trimCache(R2_CACHE, R2_MAX_BYTES));
    }
    return res;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidateMapbox(event) {
  const cache = await caches.open(MAPBOX_CACHE);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then((res) => {
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached ?? (await network);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (isR2Host(url)) {
    event.respondWith(cacheFirstR2(event));
    return;
  }
  if (isMapboxHost(url)) {
    event.respondWith(staleWhileRevalidateMapbox(event));
    return;
  }
  // Default: network-first via browser default.
});
