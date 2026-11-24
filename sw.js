const CACHE_PREFIX = 'network-pathfinder-';
const CACHE_NAME = `${CACHE_PREFIX}static-v3`;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) =>
            key === 'pwa-static-v1' ||
            (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' ||
      new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request);
        if (response.ok && response.type === 'basic') {
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;
        throw error;
      }
    })()
  );
});