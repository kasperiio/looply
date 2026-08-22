import { parseGeoJson } from './parseGeoJson.js';
import { LOOPLY_BIKE_PROFILE, LOOPLY_RUN_PROFILE } from './profiles.js';

const BROUTER_BASE = 'https://brouter.de/brouter';
const PROFILE_UPLOAD_URL = 'https://brouter.de/brouter/profile';
const BROUTER_TIMEOUT_MS = 12000;

export function isIslandError(message = '') {
  return /island|no route|cannot be reached/i.test(message);
}

/**
 * brouter.de rate-limits with 403 (and 429 if it ever switches). This has to be
 * told apart from every other failure: an expired or unknown custom profile
 * answers 500, which IS worth re-uploading and retrying, whereas retrying a
 * rate-limited request — let alone re-uploading the profile first — sends more
 * traffic at the exact moment the server is asking for less.
 */
export function isRateLimited(err) {
  return err?.status === 403 || err?.status === 429;
}

/** An unknown/expired uploaded profile — the one case a re-upload fixes. */
function isStaleProfileError(err) {
  return err?.status === 500;
}

/**
 * The caller walked away — a new generation started, or the route was cleared.
 * Distinct from a timeout: nothing failed, the answer just stopped mattering,
 * so callers must not surface it as an error.
 */
export function isAbortError(err) {
  return err?.aborted === true;
}

/**
 * Standard-profile fallback, used only when the custom profile upload or a
 * request with it fails (brouter.de purges uploaded profiles eventually).
 */
function selectFallbackProfile(mode, bikeType, surfacePref, wellLit = false) {
  if (mode === 'cycling') {
    if (bikeType === 'mtb') return 'mtb';
    if (bikeType === 'gravel') return 'gravel';
    return 'fastbike';
  }
  const pref = wellLit && surfacePref === 'trail' ? 'any' : surfacePref;
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

async function requestRoute(params, signal) {
  if (signal?.aborted) {
    const abort = new Error('Route request cancelled');
    abort.aborted = true;
    throw abort;
  }

  // One controller fires for either reason — the per-request timeout, or the
  // caller abandoning the whole generation — and the two are told apart after
  // the fact by asking the caller's signal which one it was.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BROUTER_TIMEOUT_MS);
  const relayAbort = () => controller.abort();
  signal?.addEventListener('abort', relayAbort, { once: true });

  let res;
  try {
    res = await fetch(`${BROUTER_BASE}?${params}`, { signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      if (signal?.aborted) {
        const abort = new Error('Route request cancelled');
        abort.aborted = true;
        throw abort;
      }
      throw new Error('BRouter request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', relayAbort);
  }

  if (!res.ok) {
    const text = await res.text();
    const error = new Error(text.trim().slice(0, 300) || `BRouter error ${res.status}`);
    // Callers branch on the status, so it has to survive as more than prose.
    error.status = res.status;
    throw error;
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
  bikeType = 'road',
  surfacePref = 'any',
  wellLit = false,
  elevationBias = 50,
  alternativeidx = 0,
  signal,
}) {
  const lonlats = waypoints
    .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join('|');

  const kind = mode === 'running' ? 'run' : 'bike';
  const { uphillcost, downhillcost } = elevationCosts(elevationBias);

  // How hard running routes avoid car-traffic roads, by surface mode:
  // Road mode accepts them (that's where the pavement is), trail mode
  // strongly prefers to stay off them.
  const ROAD_AVERSION = { paved: 0.7, any: 1, trail: 1.6 };

  const buildCustomParams = (profileId) => {
    const params = baseParams(lonlats, profileId, alternativeidx);
    params.set('profile:uphillcost', String(uphillcost));
    params.set('profile:downhillcost', String(downhillcost));
    if (wellLit) params.set('profile:prefer_lit', '1');

    if (mode === 'cycling') {
      // discipline decides surface — the surface selector doesn't apply
      if (bikeType === 'mtb') {
        params.set('profile:mtb', '1');
        params.set('profile:prefer_unpaved', '1');
        params.set('profile:avoid_unsafe', '1');
      } else if (bikeType === 'gravel') {
        params.set('profile:prefer_unpaved', '1');
        params.set('profile:avoid_unsafe', '1');
      } else {
        params.set('profile:avoid_unpaved', '1');
      }
      return params;
    }

    if (surfacePref === 'paved') params.set('profile:avoid_unpaved', '1');
    if (surfacePref === 'trail') params.set('profile:prefer_unpaved', '1');
    params.set('profile:road_aversion', String(ROAD_AVERSION[surfacePref] ?? 1));
    return params;
  };

  // Try the custom profile. Only two failures are worth spending more requests
  // on: an expired uploaded profile (re-upload once and retry) and a genuinely
  // broken custom-profile path (fall back to a standard profile). Routing
  // errors and rate limiting are rethrown untouched — retrying either one just
  // burns quota, and under a 403 that is precisely the wrong response.
  try {
    const profileId = await getCustomProfileId(kind);
    try {
      return await requestRoute(buildCustomParams(profileId), signal);
    } catch (err) {
      if (isIslandError(err.message) || isRateLimited(err) || isAbortError(err)) throw err;
      if (!isStaleProfileError(err)) throw err;
      customProfileIds.delete(kind);
      const freshId = await getCustomProfileId(kind);
      return await requestRoute(buildCustomParams(freshId), signal);
    }
  } catch (err) {
    if (isIslandError(err.message) || isRateLimited(err) || isAbortError(err)) throw err;
    // Custom-profile path is down entirely — fall back to standard profiles.
    const profile = selectFallbackProfile(mode, bikeType, surfacePref, wellLit);
    const params = baseParams(lonlats, profile, alternativeidx);
    if (UPHILL_TUNABLE_PROFILES.has(profile)) {
      params.set('profile:uphillcostfactor', uphillCostFactor(elevationBias));
    }
    return requestRoute(params, signal);
  }
}

/**
 * Upload the activity's profile ahead of time so the first Generate doesn't
 * pay the round trip. Failures are ignored — fetchRoute retries and falls
 * back on its own.
 */
export function warmupProfile(mode) {
  getCustomProfileId(mode === 'running' ? 'run' : 'bike').catch(() => {});
}
