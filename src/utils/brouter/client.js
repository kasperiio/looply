import { parseGeoJson } from './parseGeoJson.js';

const BROUTER_BASE = 'https://brouter.de/brouter';
const BROUTER_TIMEOUT_MS = 12000;

export function isIslandError(message = '') {
  return /island|no route|cannot be reached/i.test(message);
}

function selectProfile(mode, surfacePref, wellLit = false) {
  const pref = wellLit && surfacePref === 'trail' ? 'any' : surfacePref;

  if (mode === 'cycling') {
    if (pref === 'paved') return 'fastbike';
    if (pref === 'trail') return 'MTB';
    return 'safety';
  }
  if (pref === 'trail') return 'hiking-mountain';
  return 'trekking';
}

function uphillCost(elevationBias) {
  const t = elevationBias / 100;
  return (5.0 * Math.pow(0.04, t)).toFixed(2);
}

export async function fetchRoute({
  waypoints,
  mode = 'running',
  surfacePref = 'any',
  wellLit = false,
  elevationBias = 50,
  alternativeidx = 0,
}) {
  const profile = selectProfile(mode, surfacePref, wellLit);

  const lonlats = waypoints
    .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join('|');

  const params = new URLSearchParams({
    lonlats,
    profile,
    alternativeidx: String(alternativeidx),
    format: 'geojson',
    avoid_motorways: 'true',
    uphillcostfactor: uphillCost(elevationBias),
  });

  if (surfacePref === 'paved' || wellLit) params.set('avoid_unpaved', 'true');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BROUTER_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${BROUTER_BASE}?${params}`, { signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('BRouter request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim().slice(0, 300));
  }

  const geojson = await res.json();
  return parseGeoJson(geojson);
}
