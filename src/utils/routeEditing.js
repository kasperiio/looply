import { haversineKm } from './geo.js';

function nearestRoutePointIndex(routePoints, lat, lng) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < routePoints.length; i++) {
    const d = haversineKm([routePoints[i][0], routePoints[i][1]], [lat, lng]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function insertWaypointByRouteOrder(route, newWaypoint) {
  const existing = route?.waypoints ?? [];
  const routePoints = route?.points ?? [];
  if (routePoints.length === 0 || existing.length === 0) return [...existing, newWaypoint];

  const targetIdx = nearestRoutePointIndex(routePoints, newWaypoint.lat, newWaypoint.lng);
  const waypointIdxs = existing.map((wp) => nearestRoutePointIndex(routePoints, wp.lat, wp.lng));
  const insertAt = waypointIdxs.findIndex((idx) => targetIdx < idx);

  if (insertAt === -1) return [...existing, newWaypoint];
  return [...existing.slice(0, insertAt), newWaypoint, ...existing.slice(insertAt)];
}

export function scatterWaypointsAlongRoute(routePoints, step = 0.1) {
  if (!Array.isArray(routePoints) || routePoints.length < 3) return [];
  const waypoints = [];
  const maxSteps = Math.floor(1 / step);
  for (let k = 1; k < maxSteps; k++) {
    const idx = Math.round((routePoints.length - 1) * (k * step));
    const p = routePoints[idx];
    if (!p) continue;
    waypoints.push({ lat: p[0], lng: p[1] });
  }
  return waypoints;
}
