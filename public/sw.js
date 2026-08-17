// Bumping this forces every existing user's browser to drop the old cache
// (which was serving stale index.html / old JS bundles after new deploys).
const CACHE_NAME = 'gari-bazar-v2';
const ASSETS_TO_CACHE = [
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and avoid browser extension scripts or third-party tracking APIs
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Navigation requests (the HTML page itself) must NEVER be served from a
  // stale cache — that was the root cause of old JS bundles being loaded
  // after new deploys (broken chat/dashboard on flaky mobile networks).
  // Always go to the network; only fall back to a real offline page if the
  // network truly fails.
  const isNavigation = event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Static assets (hashed JS/CSS/images) are safe to cache: network-first,
  // falling back to cache only when offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
