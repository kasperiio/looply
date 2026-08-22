/**
 * Nominatim geocoder with a 1-second debounce to respect rate limits.
 * https://nominatim.org/release-docs/develop/api/Search/
 *
 * Nominatim's usage policy wants requests identified by their application.
 * From a browser that has to come from the Referer header: `User-Agent` is a
 * forbidden header name, so `fetch` silently drops any value set for it and
 * setting one only looks like compliance. Identification therefore relies on
 * the page's own origin being sent as Referer.
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
 * Compact human-readable naming for a Nominatim result (search or reverse).
 * The raw display_name lists the full admin hierarchy down to postcode and
 * country; users only need the place, its street, and the locality.
 *
 * Returns { primary, secondary, label }:
 *   primary   — POI name, street + number, or the most specific area
 *   secondary — context: street (for POIs), neighbourhood, city
 *   label     — "primary, secondary" one-liner for the input field / app state
 */
export function formatPlace(result) {
  const a = result?.address ?? {};
  const road = [a.road, a.house_number].filter(Boolean).join(' ');
  const area = a.neighbourhood || a.suburb || '';
  const locality = a.city || a.town || a.village || a.municipality || '';

  const primary =
    result?.name ||
    road ||
    area ||
    locality ||
    result?.display_name?.split(',')[0]?.trim() ||
    'Unknown place';

  const parts = [];
  if (road && road !== primary) parts.push(road);
  if (area && area !== primary) parts.push(area);
  if (locality && locality !== primary && locality !== area) parts.push(locality);
  const secondary = parts.join(', ');

  return {
    primary,
    secondary,
    label: secondary ? `${primary}, ${secondary}` : primary,
  };
}

const MAX_SEARCH_RESULTS = 5;

// Address-layer classes; Nominatim's own layer=address filter still returns
// shops with house numbers, so filtering happens here.
const ADDRESS_CLASSES = new Set(['place', 'boundary', 'building']);

function isAddressResult(r) {
  if (ADDRESS_CLASSES.has(r.class)) return true;
  // streets are ways; highway *nodes* are street furniture (bus stops,
  // traffic signals) — POIs, not addresses
  if (r.class === 'highway') return r.osm_type !== 'node';
  return false;
}

/**
 * Search for an address, street, or locality — POIs (shops, amenities, bus
 * stops) are filtered out, and results that format to the same label (e.g.
 * segments of one street) are deduped.
 * Each result: { lat, lon, display_name, address, boundingbox }
 */
export async function searchPlace(query) {
  if (!query || query.trim().length < 2) return [];
  await rateLimit();

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '10',
    addressdetails: '1',
  });

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'Accept-Language': 'en' },
  });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const results = await res.json();

  const seenLabels = new Set();
  return results
    .filter((r) => {
      if (!isAddressResult(r)) return false;
      const label = formatPlace(r).label;
      if (seenLabels.has(label)) return false;
      seenLabels.add(label);
      return true;
    })
    .slice(0, MAX_SEARCH_RESULTS);
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
    headers: { 'Accept-Language': 'en' },
  });

  if (!res.ok) throw new Error(`Nominatim reverse error: ${res.status}`);
  const data = await res.json();
  if (!data.display_name && !data.address) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return formatPlace(data).label;
}
