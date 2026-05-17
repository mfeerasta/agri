/* Zameen Web Push handler. Imported by the main service worker via importScripts. */
/* eslint-disable no-restricted-globals */

self.addEventListener('sync', (event) => {
  if (event.tag === 'zameen-drain-queue') {
    event.waitUntil(
      fetch('/api/sync/drain-trigger', { method: 'POST' }).catch(() => undefined),
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (_e) {
    payload = { title: 'Zameen', body: event.data.text(), deepLink: '/' };
  }
  const title = payload.title || 'Zameen';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag,
    data: { deepLink: payload.deepLink || '/' },
    requireInteraction: payload.priority === 'high',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.deepLink) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.focus();
          if ('navigate' in w) w.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
