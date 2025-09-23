const CACHE_NAME = 'controlfin-cache-v2'; // Incremented version to ensure old cache is cleared
const CORE_ASSETS = [
  './',
  './index.html',
  './bundle.js',
  './manifest.json',
  './logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache and caching core assets');
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
      return;
  }

  // Use the 'Stale-While-Revalidate' strategy
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // If the request is successful, update the cache.
        if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            cache.put(event.request, responseToCache);
        }
        return networkResponse;
      }).catch(err => {
        // Network failed, do nothing, the cached response (if any) is already served.
        console.error('Fetch failed:', err);
        // This catch is to prevent unhandled promise rejection errors.
      });

      // Return the cached response immediately if it exists, 
      // otherwise wait for the network response.
      // The network request is always made in the background to update the cache.
      return cachedResponse || fetchPromise;
    })
  );
});