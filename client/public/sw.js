// Pulse Service Worker for Browser Push Notifications and Offline Resilience
const CACHE_NAME = 'pulse-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification received from Pulse backend
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'Pulse — The world, understood.';
    const options = {
      body: payload.body || 'A new verified development is available.',
      icon: payload.icon || '/favicon.ico',
      badge: payload.badge || '/favicon.ico',
      tag: payload.tag || 'pulse-update',
      data: payload.data || {},
      requireInteraction: false,
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('[Service Worker] Error displaying push notification:', err);
  }
});

// User clicked on a notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
