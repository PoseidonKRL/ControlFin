const CACHE_NAME = 'controlfin-cache-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './bundle.js',
  './manifest.json',
  './logo192.png',
  './logo512.png',
  'https://cdn.tailwindcss.com',
  'https://rsms.me/inter/inter.css',
  'https://www.transparenttextures.com/patterns/stardust.png'
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

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);

        if (cachedResponse) {
            return cachedResponse;
        }

        try {
            const networkResponse = await fetch(event.request);
            if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                await cache.put(event.request, responseToCache);
            }
            return networkResponse;
        } catch (error) {
            console.error('Fetch failed:', error);
        }
    })
  );
});