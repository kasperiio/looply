import {
  bearingDeg,
  buildCircularWaypoints,
  circleRadius,
  findNearbyTrailPoints,
  haversineKm,
  pointAlongBearing,
  snapToTrails,
} from '../utils/circularRoute.js';
import { fetchRoute, isIslandError } from '../utils/brouter.js';
import { scatterWaypointsAlongRoute } from '../utils/routeEditing.js';
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

/**
 * Generate ranked route alternatives for a circular loop.
 * @returns {Promise<{ routes: object[] } | { routes: [], error: string }>}
 */
export async function generateRoutes({
  startPoint,
  distance,
  mode,
  surfacePref,
  wellLit,
  elevationBias,
  preferredArea = null,
  prioritizeArea = false,
}) {
  if (!isFinitePoint(startPoint)) {
    return { routes: [], error: 'Please set a start point first.' };
  }
  if (!Number.isFinite(distance) || distance <= 0) {
    return { routes: [], error: 'Distance is invalid. Please adjust the distance slider and try again.' };
  }

  const { lat, lng } = startPoint;
  const toleranceKm = Math.max(1, distance * 0.1);
  const routeRequestCache = new Map();
  const areaTarget = isFinitePoint(preferredArea) ? preferredArea : null;
  const preferredBearing = areaTarget
    ? bearingDeg([lat, lng], [areaTarget.lat, areaTarget.lng])
    : null;
  const BASE_BEARINGS = preferredBearing == null
    ? [0, 120, 240]
    : [preferredBearing - 26, preferredBearing, preferredBearing + 26];

  const trailPoints = surfacePref === 'trail'
    ? await findNearbyTrailPoints(lat, lng, Math.max(distance * 1.5, 2))
    : [];

  async function tryBearing(base) {
    const candidates = [];
    const seen = new Set();
    let closeMatches = 0;

    for (const offset of RETRY_OFFSETS) {
      let calibratedTargetKm = distance;
      let bestForOffset = null;

      for (let pass = 0; pass < 3; pass++) {
        const snapRadiusKm = circleRadius(calibratedTargetKm, surfacePref) * 0.6;
        const routeRadiusKm = circleRadius(calibratedTargetKm, surfacePref);

        let wps = buildCircularWaypoints(lat, lng, calibratedTargetKm, base + offset, surfacePref);
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
          wps = snapToTrails(wps, trailPoints, snapRadiusKm);
        }

        const waypoints = [[lat, lng], ...wps, [lat, lng]];

        const fetchCandidate = async (alternativeidx) => {
          const cacheKey = requestKey(waypoints, mode, surfacePref, wellLit, elevationBias, alternativeidx);
          let routePromise = routeRequestCache.get(cacheKey);
          if (!routePromise) {
            routePromise = fetchRoute({ waypoints, mode, surfacePref, wellLit, elevationBias, alternativeidx });
            routeRequestCache.set(cacheKey, routePromise);
          }
          const route = await routePromise;
          return { ...route, waypoints: scatterWaypointsAlongRoute(route.points, 0.1) };
        };

        try {
          const routeWithWaypoints = await fetchCandidate(0);
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
            // for them is a cheap extra source of variety.
            try {
              const alt = await fetchCandidate(1);
              const altSig = routeSignature(alt);
              if (!seen.has(altSig)) {
                seen.add(altSig);
                candidates.push(alt);
              }
            } catch {
              // alternatives are optional
            }
            break;
          }

          const ratio = distance / Math.max(routeWithWaypoints.distance, 1);
          calibratedTargetKm = Math.max(
            distance * 0.6,
            Math.min(distance * 1.9, calibratedTargetKm * ratio)
          );
        } catch (e) {
          if (!isIslandError(e.message)) break;
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

      if (
        candidates.length >= TARGET_CANDIDATES_PER_BEARING &&
        closeMatches >= TARGET_CLOSE_MATCHES_PER_BEARING
      ) {
        break;
      }
    }

    return candidates;
  }

  const results = await Promise.all(BASE_BEARINGS.map(tryBearing));
  const deduped = new Map();
  results.flat().forEach((route) => {
    const sig = routeSignature(route);
    if (!deduped.has(sig)) deduped.set(sig, route);
  });

  const routes = sortRoutesByPreferences(Array.from(deduped.values()), {
    targetDistanceKm: distance,
    surfacePref,
    wellLit,
    elevationBias,
    areaTarget,
    prioritizeArea,
  }).slice(0, MAX_ROUTE_RESULTS);

  if (routes.length === 0) {
    return {
      routes: [],
      error: 'No routable path found near this location. Try a different start point.',
    };
  }

  return { routes };
}
