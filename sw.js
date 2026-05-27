/* VERTAX-01 service worker.
 * Two-cache strategy:
 *   STATIC — app shell (HTML/JS/CSS/font). Cache-first.
 *   IMG    — vinyl covers from third-party CDNs. Cache-first, runtime only.
 * /api/* and api.discogs.com are intentionally NOT touched — UI handles
 * offline state for those (graceful fail).
 */

const STATIC_CACHE = 'vertax-static-v2';
const IMG_CACHE = 'vertax-images-v1';
const IMG_CACHE_LIMIT = 200; /* covers retained */

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dist/app.css',
  '/dist/app.js',
  '/fonts/ShareTechMono-Regular.woff2',
];

/* Image CDNs we know vinyl/cover art comes from. */
const IMG_HOSTS = [
  'i.discogs.com',
  'img.discogs.com',
  'i.scdn.co',
  'e-cdns-images.dzcdn.net',
  'cdns-images.dzcdn.net',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keepCaches = new Set([STATIC_CACHE, IMG_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keepCaches.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

/* Trim oldest entries from IMG cache to stay under limit. */
async function trimImageCache() {
  try {
    const cache = await caches.open(IMG_CACHE);
    const keys = await cache.keys();
    if (keys.length <= IMG_CACHE_LIMIT) return;
    const toDrop = keys.length - IMG_CACHE_LIMIT;
    for (let i = 0; i < toDrop; i++) await cache.delete(keys[i]);
  } catch (_) {}
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  /* Skip API + raw Discogs JSON — UI's job to handle offline for these. */
  if (url.pathname.startsWith('/api/') || url.hostname === 'api.discogs.com') return;

  /* Third-party cover images — cache-first runtime cache. */
  if (IMG_HOSTS.indexOf(url.hostname) >= 0) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          if (hit) return hit;
          return fetch(req)
            .then((resp) => {
              if (resp && (resp.ok || resp.type === 'opaque')) {
                cache.put(req, resp.clone()).then(trimImageCache);
              }
              return resp;
            })
            .catch(() => hit || new Response('', { status: 504, statusText: 'offline' }));
        })
      )
    );
    return;
  }

  /* Same-origin static — cache-first, network refresh in background. */
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          if (resp && resp.ok && url.origin === location.origin) {
            const clone = resp.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
