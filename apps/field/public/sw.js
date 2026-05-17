/* Zameen Field service worker. Handles Web Push + notification clicks.
 * Kept minimal so offline caching can be layered in later via next-pwa or
 * Workbox without conflicting with the push handler.
 */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

importScripts('/sw-push.js');
