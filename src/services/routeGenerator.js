import {
  bearingDeg,
  buildCircularWaypoints,
  circleRadius,
  findNearbyTrailPoints,
  haversineKm,
  pointAlongBearing,
  snapToTrails,
} from '../utils/circularRoute.js';
import { fetchRoute, isAbortError, isRateLimited } from '../utils/brouter.js';
import { withEditableWaypoints } from '../utils/routeEditing.js';
import {
  requestKey,
  routeSignature,
  sortRoutesByPreferences,
} from '../utils/routeRanking.js';
import { isFinitePoint } from '../utils/urlState.js';

const MAX_ROUTE_RESULTS = 10;
const TARGET_CANDIDATES_PER_BEARING = 4;
const TARGET_CLOSE_MATCHES_PER_BEARING = 2;
const RETRY_OFFSETS = [0, 45, 90, 135, 180, 225, 270, 315];
const CALIBRATION_PASSES = 3;
// A learned calibration is only trustworthy within this band — outside it the
// probe hit something pathological (a ferry, a dead end) rather than measuring
// the local road network.
const CALIBRATION_MIN = 0.5;
const CALIBRATION_MAX = 2;
// Concurrent offset chains per bearing. With 3 bearings this caps global
// concurrency at 3 in-flight requests. It was 2 (so 6), which measurably
// tripped brouter.de's rate limiter: a single generate drew 15 x HTTP 403.
// The calibration probe below means each offset now usually needs one request
// rather than two or three, so the lost parallelism costs little wall clock.
const OFFSET_WORKERS_PER_BEARING = 1;

// BRouter responses are deterministic for identical requests, so cached
// results survive across generations — regenerating after tweaking one
// setting only pays for the requests that actually changed.
//
// The budget is counted in route points, not entries: a 100 km ride carries
// hundreds of times the geometry of a 2 km loop, so an entry count is a poor
// proxy for how much memory the cache is actually holding. ~400k points is
// roughly 10 MB of [lat, lng, ele] triples. The entry cap stays on as a
// backstop against a long session of very small routes.
const ROUTE_CACHE_MAX_POINTS = 400_000;
const ROUTE_CACHE_MAX_ENTRIES = 300;
const sharedRouteCache = new Map();
const entryPointCounts = new Map();
let cachedPointTotal = 0;

function dropCacheEntry(key) {
  sharedRouteCache.delete(key);
  cachedPointTotal -= entryPointCounts.get(key) ?? 0;
  entryPointCounts.delete(key);
}

/** Evict least-recently-used entries until back inside both budgets. */
function evictToBudget(keep) {
  for (const key of sharedRouteCache.keys()) {
    if (
      cachedPointTotal <= ROUTE_CACHE_MAX_POINTS &&
      sharedRouteCache.size <= ROUTE_CACHE_MAX_ENTRIES
    ) {
      break;
    }
    if (key === keep) continue;
    dropCacheEntry(key);
  }
}

function cachedFetchRoute(cacheKey, factory) {
  const cached = sharedRouteCache.get(cacheKey);
  if (cached) {
    // refresh recency so hot entries survive eviction
    sharedRouteCache.delete(cacheKey);
    sharedRouteCache.set(cacheKey, cached);
    return cached;
  }

  const promise = factory();
  sharedRouteCache.set(cacheKey, promise);
  promise.then(
    (route) => {
      // A concurrent eviction may already have dropped this entry.
      if (!sharedRouteCache.has(cacheKey)) return;
      const points = route?.points?.length ?? 0;
      entryPointCounts.set(cacheKey, points);
      cachedPointTotal += points;
      evictToBudget(cacheKey);
    },
    () => dropCacheEntry(cacheKey)
  );
  return promise;
}

/** Surface behavior implied by the cycling discipline. */
function effectiveSurface(mode, bikeType, surfacePref) {
  if (mode !== 'cycling') return surfacePref;
  return bikeType === 'road' ? 'paved' : 'trail';
}

/**
 * Generate ranked route alternatives for a circular loop.
 * @returns {Promise<{ routes: object[] } | { routes: [], error: string }>}
 */
export async function generateRoutes({
  startPoint,
  distance,
  mode,
  bikeType = 'road',
  surfacePref,
  wellLit,
  elevationBias,
  preferredArea = null,
  prioritizeArea = false,
  signal,
  onPartial,
}) {
  if (!isFinitePoint(startPoint)) {
    return { routes: [], error: 'Please set a start point first.' };
  }
  if (!Number.isFinite(distance) || distance <= 0) {
    return { routes: [], error: 'Distance is invalid. Please adjust the distance slider and try again.' };
  }

  const { lat, lng } = startPoint;
  const toleranceKm = Math.max(1, distance * 0.1);
  const effectiveSurfacePref = effectiveSurface(mode, bikeType, surfacePref);
  const modeKey = mode === 'cycling' ? `cycling:${bikeType}` : mode;
  const areaTarget = isFinitePoint(preferredArea) ? preferredArea : null;
  const preferredBearing = areaTarget
    ? bearingDeg([lat, lng], [areaTarget.lat, areaTarget.lng])
    : null;
  const BASE_BEARINGS = preferredBearing == null
    ? [0, 120, 240]
    : [preferredBearing - 26, preferredBearing, preferredBearing + 26];

  const trailPoints = effectiveSurfacePref === 'trail'
    ? await findNearbyTrailPoints(lat, lng, Math.max(distance * 1.5, 2))
    : [];

  // The generator only ever asks for a target inside this band; outside it the
  // n-gon degenerates rather than converging.
  const clampTarget = (km) =>
    Math.max(distance * 0.6, Math.min(distance * 1.9, km));

  function buildWaypoints(targetKm, bearing) {
    const routeRadiusKm = circleRadius(targetKm, effectiveSurfacePref);
    let wps = buildCircularWaypoints(lat, lng, targetKm, bearing, effectiveSurfacePref);

    if (areaTarget) {
      const desiredDistKm = haversineKm([lat, lng], [areaTarget.lat, areaTarget.lng]);
      // Start sits on the ring, so loop points lie 0…2R from it; keep the
      // biased vertex inside that band or the loop degenerates.
      const biasedDistKm = Math.max(routeRadiusKm * 0.6, Math.min(routeRadiusKm * 1.9, desiredDistKm));
      const biasedPoint = pointAlongBearing(lat, lng, preferredBearing, biasedDistKm);

      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < wps.length; i++) {
        const d = haversineKm(wps[i], biasedPoint);
        if (d < closestDist) {
          closestDist = d;
          closestIdx = i;
        }
      }
      wps[closestIdx] = biasedPoint;
    }

    if (trailPoints.length > 0) {
      wps = snapToTrails(wps, trailPoints, routeRadiusKm * 0.6);
    }

    return [[lat, lng], ...wps, [lat, lng]];
  }

  async function fetchCandidate(waypoints, alternativeidx) {
    const cacheKey = requestKey(waypoints, modeKey, surfacePref, wellLit, elevationBias, alternativeidx);
    const route = await cachedFetchRoute(cacheKey, () =>
      fetchRoute({ waypoints, mode, bikeType, surfacePref, wellLit, elevationBias, alternativeidx, signal })
    );
    return withEditableWaypoints(route);
  }

  // ROAD_DETOUR is a global average, but the ratio of road distance to
  // straight-line distance is really a property of one neighbourhood: a dense
  // grid routes near the average, a lakeside suburb with few through-roads is
  // far off it. Measure it once here, before fanning out, so every bearing and
  // offset starts from the local value instead of rediscovering it — which is
  // what made most offsets spend two or three requests to yield one candidate.
  //
  // Deliberately a single serial probe rather than a running average over
  // in-flight results: a racy average makes the requested targets depend on
  // network timing, which changes the cache keys run to run and destroys the
  // cross-generation reuse the shared route cache exists for. One fixed probe
  // costs one round trip and stays reproducible.
  // Dedups first: the probe route also turns up among its own bearing's
  // candidates, and progressive publishes would otherwise put the same loop
  // in the pager twice.
  const rankRoutes = (pool) => {
    const deduped = new Map();
    for (const route of pool) {
      const sig = routeSignature(route);
      if (!deduped.has(sig)) deduped.set(sig, route);
    }
    return sortRoutesByPreferences(Array.from(deduped.values()), {
      targetDistanceKm: distance,
      surfacePref: effectiveSurfacePref,
      wellLit,
      elevationBias,
      areaTarget,
      prioritizeArea,
    }).slice(0, MAX_ROUTE_RESULTS);
  };

  // Everything found so far, across the probe and every bearing. Published
  // progressively so the map shows a usable loop within a second or two
  // instead of staying blank until the last of ~27 requests lands.
  const found = [];
  const publish = () => {
    if (!onPartial || signal?.aborted || found.length === 0) return;
    onPartial(rankRoutes(found));
  };

  const probeWaypoints = buildWaypoints(distance, BASE_BEARINGS[0]);
  let areaCalibration = 1;
  let probeRoute = null;

  try {
    probeRoute = await fetchCandidate(probeWaypoints, 0);
    const sample = distance / Math.max(probeRoute.distance, 0.1);
    if (sample >= CALIBRATION_MIN && sample <= CALIBRATION_MAX) {
      areaCalibration = sample;
    }
    // First thing on screen: the probe is already a real routed loop.
    found.push(probeRoute);
    publish();
  } catch (e) {
    if (isAbortError(e)) return { routes: [], aborted: true };
    // Probe failed (island, timeout). Fall back to the global average and let
    // the per-offset chains calibrate themselves as they did before.
  }

  // Once the server starts refusing, every further request makes it worse and
  // none of them succeed. One 403 stops the whole fan-out rather than letting
  // each of the remaining offsets discover it independently.
  let rateLimited = false;
  let aborted = false;

  async function tryBearing(base) {
    const candidates = [];
    const seen = new Set();
    const pendingAlternatives = [];
    let closeMatches = 0;
    let nextOffsetIdx = 0;

    const enoughResults = () =>
      candidates.length >= TARGET_CANDIDATES_PER_BEARING &&
      closeMatches >= TARGET_CLOSE_MATCHES_PER_BEARING;

    // One offset's calibration chain is inherently serial (each pass uses
    // the previous pass's measured distance), but separate offsets are
    // independent — run them through a small worker pool.
    async function runOffset(offset) {
      // Seeded from the calibration probe, so the first request usually lands
      // inside tolerance instead of being spent learning what is already known.
      let calibratedTargetKm = clampTarget(distance * areaCalibration);
      let bestForOffset = null;

      for (let pass = 0; pass < CALIBRATION_PASSES; pass++) {
        const waypoints = buildWaypoints(calibratedTargetKm, base + offset);

        try {
          const routeWithWaypoints = await fetchCandidate(waypoints, 0);
          const errorKm = Math.abs(routeWithWaypoints.distance - distance);
          const sig = routeSignature(routeWithWaypoints);

          if (!seen.has(sig)) {
            seen.add(sig);
            candidates.push(routeWithWaypoints);
          }

          if (!bestForOffset || errorKm < Math.abs(bestForOffset.distance - distance)) {
            bestForOffset = routeWithWaypoints;
          }

          if (errorKm <= toleranceKm) {
            closeMatches += 1;
            // These waypoints hit the target — BRouter's first alternative
            // for them is a cheap extra source of variety. Collected off the
            // critical path so the worker moves on immediately.
            pendingAlternatives.push(
              fetchCandidate(waypoints, 1)
                .then((alt) => {
                  const altSig = routeSignature(alt);
                  if (!seen.has(altSig)) {
                    seen.add(altSig);
                    candidates.push(alt);
                  }
                })
                .catch(() => {})
            );
            break;
          }

          const ratio = distance / Math.max(routeWithWaypoints.distance, 1);
          calibratedTargetKm = clampTarget(calibratedTargetKm * ratio);
        } catch (e) {
          // Both an island and a rate limit end this offset's chain; a rate
          // limit additionally halts every offset still queued, and an abort
          // halts everything for good.
          if (isRateLimited(e)) rateLimited = true;
          if (isAbortError(e)) aborted = true;
          break;
        }
      }

      if (bestForOffset) {
        const sig = routeSignature(bestForOffset);
        if (!seen.has(sig)) {
          seen.add(sig);
          candidates.push(bestForOffset);
        }
      }
    }

    async function worker() {
      while (!rateLimited && !aborted && !enoughResults() && nextOffsetIdx < RETRY_OFFSETS.length) {
        const offset = RETRY_OFFSETS[nextOffsetIdx++];
        await runOffset(offset);
      }
    }

    await Promise.all(
      Array.from({ length: OFFSET_WORKERS_PER_BEARING }, () => worker())
    );
    await Promise.all(pendingAlternatives);

    found.push(...candidates);
    publish();

    return candidates;
  }

  await Promise.all(BASE_BEARINGS.map(tryBearing));

  if (signal?.aborted || aborted) return { routes: [], aborted: true };

  // `found` already holds the probe route and every bearing's candidates;
  // rankRoutes dedups.
  const routes = rankRoutes(found);

  if (routes.length === 0) {
    return {
      routes: [],
      error: 'No routable path found near this location. Try a different start point.',
    };
  }

  return { routes };
}
