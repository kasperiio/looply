/**
 * Looply service worker.
 *
 * NOT imported by app code — the Vite build emits this file to /sw.js with
 * the release version substituted into __LOOPLY_VERSION__ (see
 * vite.config.js). That substitution is the whole point: a browser only
 * treats a worker as updated when its bytes differ, so a service worker
 * shipped as a static file can never offer users a new build.
 *
 * Deliberately no offline support. Looply cannot do anything useful without
 * a network — every route comes from BRouter — so serving a cached shell
 * offline would only produce an app that loads and then fails. The document
 * is never intercepted, which means it always comes from the network and can
 * never pin the user to an old release.
 *
 * The only thing cached is content-hashed build output, purely for load
 * speed. Those URLs are fingerprinted by Vite, so a cached entry can never
 * be a stale version of anything.
 */

const VERSION = '__LOOPLY_VERSION__';
const CACHE_NAME = `looply-${VERSION}`;

const HASHED_ASSET = /^\/assets\//;

self.addEventListener('install', () => {
  // Take over as soon as possible: the page force-reloads on controllerchange,
  // so a waiting worker would just delay the user reaching the new build.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !HASHED_ASSET.test(url.pathname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })()
  );
});
