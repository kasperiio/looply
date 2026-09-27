import { calcAscentM, haversineKm } from './geo.js';

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

/**
 * The same loop run the other way. Geometry, surface segments and edit
 * handles are flipped in place — no routing request, so the loop cannot
 * change shape. A closed loop climbs what it descends, so ascent barely
 * moves, but it is recomputed from the flipped points so the figure always
 * matches the exported GPX. Only valid where one-way rules don't apply (on
 * foot); a ride has to be re-routed instead.
 */
export function reverseRoute(route) {
  const points = [...route.points].reverse();
  return {
    ...route,
    points,
    ascent: calcAscentM(points),
    segments: [...(route.segments ?? [])]
      .reverse()
      .map((seg) => ({ ...seg, points: [...seg.points].reverse() })),
    waypoints: [...(route.waypoints ?? [])].reverse(),
  };
}

/**
 * Attach draggable edit handles to a routed result. The single source of
 * truth for shaping BRouter routes into app state — used by both initial
 * generation and manual-edit recalculation so the two flows can't drift.
 */
export function withEditableWaypoints(route) {
  return { ...route, waypoints: scatterWaypointsAlongRoute(route.points, 0.1) };
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
