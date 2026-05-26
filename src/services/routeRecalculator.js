import { fetchRoute } from '../utils/brouter.js';
import { scatterWaypointsAlongRoute } from '../utils/routeEditing.js';
import { isFinitePoint } from '../utils/urlState.js';

/**
 * Recalculate a loop route from start + intermediate waypoints.
 * @returns {Promise<{ route: object } | { error: string }>}
 */
export async function recalcRoute({
  startPoint,
  waypointsToUse,
  mode,
  surfacePref,
  wellLit,
  elevationBias,
}) {
  if (!isFinitePoint(startPoint)) {
    return { error: 'Start point is invalid.' };
  }

  const normalizedWps = waypointsToUse
    .filter((wp) => isFinitePoint(wp))
    .map((wp) => [wp.lat, wp.lng]);
  const waypoints = [
    [startPoint.lat, startPoint.lng],
    ...normalizedWps,
    [startPoint.lat, startPoint.lng],
  ];

  try {
    const route = await fetchRoute({ waypoints, mode, surfacePref, wellLit, elevationBias });
    return {
      route: {
        ...route,
        waypoints: scatterWaypointsAlongRoute(route.points, 0.1),
      },
    };
  } catch (e) {
    const msg = e?.message
      ? `Could not update route: ${e.message}`
      : 'Could not update route with this waypoint.';
    return { error: msg };
  }
}
