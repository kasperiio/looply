import { parseGeoJson } from './parseGeoJson.js';
import { LOOPLY_BIKE_PROFILE, LOOPLY_RUN_PROFILE } from './profiles.js';

const BROUTER_BASE = 'https://brouter.de/brouter';
const PROFILE_UPLOAD_URL = 'https://brouter.de/brouter/profile';
const BROUTER_TIMEOUT_MS = 12000;

export function isIslandError(message = '') {
  return /island|no route|cannot be reached/i.test(message);
}

/**
 * Standard-profile fallback, used only when the custom profile upload or a
 * request with it fails (brouter.de purges uploaded profiles eventually).
 */
function selectFallbackProfile(mode, surfacePref, wellLit = false) {
  const pref = wellLit && surfacePref === 'trail' ? 'any' : surfacePref;

  if (mode === 'cycling') {
    if (pref === 'paved') return 'fastbike';
    if (pref === 'trail') return 'mtb';
    return 'safety';
  }
  if (pref === 'trail') return 'hiking-mountain';
  return 'trekking';
}

// Standard profiles that declare uphillcostfactor; sending the override to
// any other profile (mtb, hiking-mountain) makes brouter.de fail with 500.
const UPHILL_TUNABLE_PROFILES = new Set(['trekking', 'fastbike', 'safety']);

function uphillCostFactor(elevationBias) {
  const t = elevationBias / 100;
  return (5.0 * Math.pow(0.04, t)).toFixed(2);
}

/**
 * Elevation costs for the custom profiles: cost (in meters of detour) per
 * meter climbed/descended. Quadratic so the middle of the slider is mild.
 */
function elevationCosts(elevationBias) {
  const flatness = Math.pow(1 - elevationBias / 100, 2);
  return {
    uphillcost: Math.round(120 * flatness),
    downhillcost: Math.round(60 * flatness),
  };
}

// One upload per activity per session serves all setting combinations;
// per-request behavior comes from profile:<var> overrides.
const customProfileIds = new Map();

function getCustomProfileId(kind) {
  let promise = customProfileIds.get(kind);
  if (!promise) {
    promise = (async () => {
      const body = kind === 'bike' ? LOOPLY_BIKE_PROFILE : LOOPLY_RUN_PROFILE;
      const res = await fetch(PROFILE_UPLOAD_URL, { method: 'POST', body });
      if (!res.ok) throw new Error(`Profile upload failed: ${res.status}`);
      const data = await res.json();
      if (!data?.profileid) throw new Error('Profile upload returned no id');
      return data.profileid;
    })();
    promise.catch(() => customProfileIds.delete(kind));
    customProfileIds.set(kind, promise);
  }
  return promise;
}

async function requestRoute(params) {
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
    throw new Error(text.trim().slice(0, 300) || `BRouter error ${res.status}`);
  }

  const geojson = await res.json();
  return parseGeoJson(geojson);
}

function baseParams(lonlats, profile, alternativeidx) {
  return new URLSearchParams({
    lonlats,
    profile,
    alternativeidx: String(alternativeidx),
    format: 'geojson',
  });
}

export async function fetchRoute({
  waypoints,
  mode = 'running',
  surfacePref = 'any',
  wellLit = false,
  elevationBias = 50,
  alternativeidx = 0,
}) {
  const lonlats = waypoints
    .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join('|');

  const kind = mode === 'cycling' ? 'bike' : 'run';
  const { uphillcost, downhillcost } = elevationCosts(elevationBias);

  const buildCustomParams = (profileId) => {
    const params = baseParams(lonlats, profileId, alternativeidx);
    if (surfacePref === 'paved') params.set('profile:avoid_unpaved', '1');
    if (surfacePref === 'trail') params.set('profile:prefer_unpaved', '1');
    if (wellLit) params.set('profile:prefer_lit', '1');
    params.set('profile:uphillcost', String(uphillcost));
    params.set('profile:downhillcost', String(downhillcost));
    return params;
  };

  // Try the custom profile; if the request fails because the uploaded
  // profile expired server-side, re-upload once and retry. Routing errors
  // (islands, unreachable points) are rethrown untouched.
  try {
    const profileId = await getCustomProfileId(kind);
    try {
      return await requestRoute(buildCustomParams(profileId));
    } catch (err) {
      if (isIslandError(err.message)) throw err;
      customProfileIds.delete(kind);
      const freshId = await getCustomProfileId(kind);
      return await requestRoute(buildCustomParams(freshId));
    }
  } catch (err) {
    if (isIslandError(err.message)) throw err;
    // Custom-profile path is down entirely — fall back to standard profiles.
    const profile = selectFallbackProfile(mode, surfacePref, wellLit);
    const params = baseParams(lonlats, profile, alternativeidx);
    if (UPHILL_TUNABLE_PROFILES.has(profile)) {
      params.set('profile:uphillcostfactor', uphillCostFactor(elevationBias));
    }
    return requestRoute(params);
  }
}
