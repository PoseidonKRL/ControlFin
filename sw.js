const CACHE_NAME = 'controlfin-cache-v1';
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
  if (event.request.method !== 'GET') {
      return;
  }

  // Cache-first strategy for all GET requests
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // If the request is successful, update the cache
        if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            cache.put(event.request, responseToCache);
        }
        return networkResponse;
      });

      // Return cached response if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});