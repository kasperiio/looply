// Looply service worker
// Strategy:
//   - App shell (JS/CSS/HTML/fonts) → cache-first (fast repeat loads)
//   - External APIs (BRouter, Overpass, Nominatim, tile servers) → network-only
//     (route data must always be fresh; we never want stale map routes)

const CACHE_NAME = 'looply-v1';

// Resources that make up the app shell
const APP_SHELL_PATTERNS = [
  /^https?:\/\/[^/]+\/$/,            // index route
  /\.(js|css|woff2?|svg|png|ico)$/,  // static assets
];

// External services — always go to network
const NETWORK_ONLY_PATTERNS = [
  /brouter\.de/,
  /overpass-api\.de/,
  /nominatim\.openstreetmap\.org/,
  /openstreetmap\.org\/tile/,
  /tile\.(openstreetmap|thunderforest|opencyclemap)/,
];

function isNetworkOnly(url) {
  return NETWORK_ONLY_PATTERNS.some((re) => re.test(url));
}

function isAppShell(url) {
  return APP_SHELL_PATTERNS.some((re) => re.test(url));
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', () => {
  // Skip waiting so the new SW activates immediately on update
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Non-GET requests and external APIs → bypass SW entirely
  if (request.method !== 'GET' || isNetworkOnly(url)) {
    return;
  }

  if (isAppShell(url)) {
    // Cache-first: serve from cache, fall back to network and cache the response
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
  }
});
