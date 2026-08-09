import { haversineKm } from './geo.js';

export function routeSignature(route) {
  const points = route?.points ?? [];
  if (points.length === 0) return 'empty';
  const first = points[0];
  const mid = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];
  return [
    route.distance?.toFixed(3) ?? '0',
    first?.[0]?.toFixed(5) ?? '0',
    first?.[1]?.toFixed(5) ?? '0',
    mid?.[0]?.toFixed(5) ?? '0',
    mid?.[1]?.toFixed(5) ?? '0',
    last?.[0]?.toFixed(5) ?? '0',
    last?.[1]?.toFixed(5) ?? '0',
  ].join('|');
}

const GRID_CELL_KM = 0.025;
// Cell re-entries closer than this (in cell-sequence steps) are boundary
// jitter, not backtracking.
const REVISIT_GAP = 8;

function cellOf([lat, lng]) {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  return `${Math.round((lat * kmPerDegLat) / GRID_CELL_KM)}:${Math.round((lng * kmPerDegLng) / GRID_CELL_KM)}`;
}

/**
 * Fraction of the route's length that retraces ground already covered.
 * Points are hashed to a ~25 m grid; a step whose cell was last visited more
 * than REVISIT_GAP cells ago counts as backtracking. A clean loop scores ~0,
 * a pure out-and-back ~0.5.
 */
export function backtrackFraction(points) {
  if (!Array.isArray(points) || points.length < 4) return 0;

  const lastSeen = new Map();
  let seq = 0;
  let prevCell = null;
  let totalKm = 0;
  let repeatedKm = 0;

  for (let i = 1; i < points.length; i++) {
    const stepKm = haversineKm(points[i - 1], points[i]);
    totalKm += stepKm;

    const cell = cellOf(points[i]);
    if (cell !== prevCell) {
      seq += 1;
      prevCell = cell;
    }

    const prior = lastSeen.get(cell);
    if (prior != null && seq - prior > REVISIT_GAP) {
      repeatedKm += stepKm; // leave lastSeen stale so the whole stretch counts
    } else {
      lastSeen.set(cell, seq);
    }
  }

  return totalKm > 0 ? repeatedKm / totalKm : 0;
}

function surfaceFitness(route, surfacePref, wellLit) {
  const paved = route.surface?.paved ?? 0;
  const unpaved = route.surface?.unpaved ?? 0;
  if (wellLit || surfacePref === 'paved') return paved;
  if (surfacePref === 'trail') return unpaved;
  return 1 - (route.surface?.unknown ?? 0);
}

function routeDistanceToPointKm(route, point) {
  if (!point || !route?.points?.length) return Infinity;
  let best = Infinity;
  for (const p of route.points) {
    const d = haversineKm([p[0], p[1]], [point.lat, point.lng]);
    if (d < best) best = d;
  }
  return best;
}

// Ascent per km at (or above) which a route counts as fully "hilly". Calibrated
// against calcAscentM over real routes: alpine ~24 m/km, forest trails ~17,
// flat city ~6. Was 18 when ascent came from BRouter's filtered value, whose
// scale differs non-linearly (it suppresses flat terrain far more than steep).
const HILLY_ASCENT_M_PER_KM = 25;
// Candidates further off target than this fraction are dropped before
// scoring (unless that would leave fewer than two).
const DISTANCE_GATE = 0.25;

/**
 * Score candidates on an absolute 0–1 scale per criterion and sort by the
 * weighted sum. Unlike rank aggregation, magnitudes matter: a route 4 km off
 * target can no longer beat one 200 m off because it ranked one place higher
 * on terrain.
 */
export function sortRoutesByPreferences(routes, {
  targetDistanceKm,
  surfacePref,
  wellLit,
  elevationBias,
  areaTarget = null,
  prioritizeArea = false,
}) {
  if (routes.length <= 1) return routes;

  const gateKm = Math.max(1, targetDistanceKm * DISTANCE_GATE);
  const withinGate = routes.filter(
    (route) => Math.abs(route.distance - targetDistanceKm) <= gateKm
  );
  const pool = withinGate.length >= 2 ? withinGate : routes;

  const terrainTarget = elevationBias / 100;
  const useArea = prioritizeArea && areaTarget != null;

  const weights = {
    distance: 1,
    loop: 1.2,
    surface: surfacePref === 'any' && !wellLit ? 0.5 : 1,
    terrain: 0.6,
    area: useArea ? 2 : 0,
  };

  return pool
    .map((route) => {
      const distanceScore =
        1 - Math.min(1, Math.abs(route.distance - targetDistanceKm) / gateKm);
      const hilliness = Math.min(
        1,
        route.ascent / Math.max(route.distance, 0.1) / HILLY_ASCENT_M_PER_KM
      );
      const terrainScore = 1 - Math.abs(hilliness - terrainTarget);
      const surfaceScore = surfaceFitness(route, surfacePref, wellLit);
      // 0.5 backtrack (pure out-and-back) → 0; clean loop → 1.
      const loopScore = 1 - Math.min(1, backtrackFraction(route.points) / 0.5);
      const areaKm = useArea ? routeDistanceToPointKm(route, areaTarget) : 0;
      const areaScore = useArea
        ? 1 - Math.min(1, areaKm / Math.max(targetDistanceKm / 3, 0.5))
        : 0;

      return {
        route,
        score:
          distanceScore * weights.distance +
          loopScore * weights.loop +
          surfaceScore * weights.surface +
          terrainScore * weights.terrain +
          areaScore * weights.area,
        distanceError: Math.abs(route.distance - targetDistanceKm),
      };
    })
    .sort((a, b) => b.score - a.score || a.distanceError - b.distanceError)
    .map(({ route }) => route);
}

export function requestKey(waypoints, mode, surfacePref, wellLit, elevationBias, alternativeidx = 0) {
  const waypointKey = waypoints
    .map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`)
    .join('|');
  return `${waypointKey}__${mode}__${surfacePref}__${wellLit ? '1' : '0'}__${elevationBias}__${alternativeidx}`;
}
