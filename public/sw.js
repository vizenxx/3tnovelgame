const cacheVersion = new URL(self.location.href).searchParams.get('v') || 'v1';
const CACHE_NAME = `fate-engine-${cacheVersion}`;
const APP_SHELL = ['/', '/manifest.webmanifest', '/pwa-icon-192.png', '/pwa-icon-512.png', '/pwa-maskable-512.png'];
const STATIC_CACHE_PATTERNS = [/\.(?:js|css|png|svg|ico|webmanifest)$/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: '命运有了新的回响', body: event.data?.text() || '' };
  }
  const title = payload.title || '命运有了新的回响';
  const options = {
    body: payload.body || '有新的作品动态，回来看看吧。',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    data: { url: payload.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === targetUrl || client.url === self.location.origin + '/');
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
        return;
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith('/api/')) return;
  if (requestUrl.pathname.startsWith('/@vite/') || requestUrl.pathname.startsWith('/src/')) return;
  if (requestUrl.pathname.startsWith('/__/auth/')) return;
  if (requestUrl.pathname === '/manifest.webmanifest') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => networkResponse)
        .catch(() => {
          return caches.match('/').then((cachedResponse) => (
            cachedResponse || new Response('', { status: 504, statusText: 'Offline' })
          ));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          const shouldCache = STATIC_CACHE_PATTERNS.some((pattern) => pattern.test(requestUrl.pathname));

          if (shouldCache) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
