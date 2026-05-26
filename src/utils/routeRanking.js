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

function buildRanks(values, higherIsBetter = true) {
  const order = values
    .map((value, idx) => ({ value, idx }))
    .sort((a, b) => {
      const diff = higherIsBetter ? b.value - a.value : a.value - b.value;
      if (Math.abs(diff) > 1e-9) return diff;
      return a.idx - b.idx;
    });
  const ranks = Array(values.length);
  order.forEach(({ idx }, pos) => {
    ranks[idx] = pos + 1;
  });
  return ranks;
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

export function sortRoutesByPreferences(routes, {
  targetDistanceKm,
  surfacePref,
  wellLit,
  elevationBias,
  areaTarget = null,
  prioritizeArea = false,
}) {
  if (routes.length <= 1) return routes;

  const ascentPerKm = routes.map((route) => route.ascent / Math.max(route.distance, 0.1));
  const minTerrain = Math.min(...ascentPerKm);
  const maxTerrain = Math.max(...ascentPerKm);
  const terrainRange = Math.max(maxTerrain - minTerrain, 1e-9);
  const terrainTarget = elevationBias / 100;

  const terrainFitness = ascentPerKm.map((value) => {
    const normalized = (value - minTerrain) / terrainRange;
    return 1 - Math.abs(normalized - terrainTarget);
  });
  const surfaceScores = routes.map((route) => surfaceFitness(route, surfacePref, wellLit));
  const distanceErrors = routes.map((route) => Math.abs(route.distance - targetDistanceKm));
  const areaDistanceErrors = routes.map((route) =>
    prioritizeArea && areaTarget ? routeDistanceToPointKm(route, areaTarget) : Infinity);

  const terrainRanks = buildRanks(terrainFitness, true);
  const surfaceRanks = buildRanks(surfaceScores, true);
  const distanceRanks = buildRanks(distanceErrors, false);
  const areaRanks = prioritizeArea && areaTarget
    ? buildRanks(areaDistanceErrors, false)
    : Array(routes.length).fill(1);

  const surfaceWeight = (surfacePref === 'any' && !wellLit) ? 0.6 : 1;
  const terrainWeight = 1;
  const distanceWeight = 0.7;
  const areaWeight = prioritizeArea && areaTarget ? 2.4 : 0;
  const totalWeight = surfaceWeight + terrainWeight + distanceWeight + areaWeight;

  return routes
    .map((route, idx) => ({
      route,
      combinedRank:
        (surfaceRanks[idx] * surfaceWeight +
         terrainRanks[idx] * terrainWeight +
         distanceRanks[idx] * distanceWeight +
         areaRanks[idx] * areaWeight) / totalWeight,
      distanceError: distanceErrors[idx],
      areaDistanceError: areaDistanceErrors[idx],
    }))
    .sort((a, b) =>
      a.combinedRank - b.combinedRank ||
      a.areaDistanceError - b.areaDistanceError ||
      a.distanceError - b.distanceError
    )
    .map(({ route }) => route);
}

export function requestKey(waypoints, mode, surfacePref, wellLit, elevationBias) {
  const waypointKey = waypoints
    .map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`)
    .join('|');
  return `${waypointKey}__${mode}__${surfacePref}__${wellLit ? '1' : '0'}__${elevationBias}`;
}
