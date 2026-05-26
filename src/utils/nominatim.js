/**
 * Nominatim geocoder with a 1-second debounce to respect rate limits.
 * https://nominatim.org/release-docs/develop/api/Search/
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

let lastCallTime = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < 1000) {
    await new Promise((r) => setTimeout(r, 1000 - elapsed));
  }
  lastCallTime = Date.now();
}

/**
 * Search for a place by name. Returns an array of results.
 * Each result: { lat, lon, display_name, boundingbox }
 */
export async function searchPlace(query) {
  if (!query || query.trim().length < 2) return [];
  await rateLimit();

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    addressdetails: '1',
  });

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'Looply/1.0' },
  });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  return res.json();
}

/**
 * Reverse geocode [lat, lng] to a human-readable address string.
 */
export async function reverseGeocode(lat, lng) {
  await rateLimit();

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
  });

  const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'Looply/1.0' },
  });

  if (!res.ok) throw new Error(`Nominatim reverse error: ${res.status}`);
  const data = await res.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
