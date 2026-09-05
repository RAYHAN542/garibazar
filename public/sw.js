// Bumping this forces every existing user's browser to drop the old cache
// (which was serving stale index.html / old JS bundles after new deploys).
const CACHE_NAME = 'gari-bazar-v5';
const NAV_TIMEOUT_MS = 1500;
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Individual entries are tried one by one (not addAll) so that one
      // missing/failing URL doesn't abort caching of the rest -- addAll
      // fails installation entirely if even one request 404s.
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache failed for', url, err);
          })
        )
      );
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

  const isNavigation = event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html');

  if (isNavigation) {
    // Network-with-timeout, falling back to the last cached index.html, and
    // only to offline.html if there's truly nothing cached either. A slow
    // network (rather than a fully broken one) no longer means staring at a
    // blank tab for as long as the request takes -- after 1.5s the cached
    // shell/UI shows up immediately, and once the network response does
    // arrive it silently refreshes the cache for next time
    // (stale-while-revalidate), so the page is never permanently stuck on
    // an old bundle.
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        const networkFetch = fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(event.request, response.clone());
          }
          return response;
        });

        const timeout = new Promise((resolve) => {
          setTimeout(() => resolve(null), NAV_TIMEOUT_MS);
        });

        const raced = await Promise.race([networkFetch, timeout]);
        if (raced) return raced;

        // Timed out waiting on the network -- serve whatever's cached right
        // away, but let the network request keep running in the background
        // so the cache is fresh for the *next* navigation even though this
        // one didn't wait for it.
        networkFetch.catch(() => {});
        const cachedShell = (await cache.match(event.request)) || (await cache.match('/index.html'));
        if (cachedShell) return cachedShell;

        // Nothing cached and the network hasn't responded yet -- this is the
        // only remaining case where we actually wait on the network, falling
        // back to the offline page only if that also fails.
        try {
          return await networkFetch;
        } catch {
          return caches.match('/offline.html');
        }
      })()
    );
    return;
  }

  // Static assets (hashed JS/CSS/images) are content-addressed - the
  // filename itself changes whenever the content does, so a cached copy is
  // NEVER stale. Safe to serve straight from cache (instant on repeat
  // visits) and only hit the network the first time or if it's missing.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    }).catch(() => caches.match(event.request))
  );
});
