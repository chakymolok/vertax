const VERTAX_CACHE = 'vertax-static-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dist/app.css',
  '/dist/app.js',
  '/fonts/ShareTechMono-Regular.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERTAX_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERTAX_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('discogs.com')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && url.origin === location.origin) {
            const clone = response.clone();
            caches.open(VERTAX_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
