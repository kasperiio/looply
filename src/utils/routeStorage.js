/**
 * Persist the last generated route set across reloads.
 *
 * Regenerating costs ~27 BRouter requests against a free, rate-limited public
 * service, so a reload that silently throws the results away is expensive for
 * the user AND for brouter.de. The URL already restores the settings and the
 * start point; this restores the work those settings produced.
 *
 * localStorage rather than sessionStorage on purpose: the service worker
 * force-reloads the page onto every new build, and installed PWAs get closed
 * and reopened. Both should return you to your route.
 *
 * Not a route library. This is one slot holding one result set — "my saved
 * routes" needs accounts and a backend, which is a different decision.
 */

const KEY = 'looply.lastRoutes';

// A 10 km run's ten alternatives serialize to ~260 KB; a 100 km ride is
// roughly ten times that. Past this we skip the write rather than risk
// evicting the entry (or anything else on the origin) mid-session.
const MAX_BYTES = 3_000_000;

// OSM data drifts and so does the user's intent. Old enough is stale enough.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const round = (n) => (Number.isFinite(n) ? n.toFixed(5) : '-');

/**
 * Identity of a result set: every input that changes which routes come back.
 * A stored set is only reused when this matches exactly.
 */
export function routeSetSignature({
  startPoint,
  areaPoint,
  distance,
  mode,
  bikeType,
  surfacePref,
  wellLit,
  elevationBias,
}) {
  if (!startPoint) return null;
  return [
    round(startPoint.lat),
    round(startPoint.lng),
    areaPoint ? round(areaPoint.lat) : '-',
    areaPoint ? round(areaPoint.lng) : '-',
    distance,
    mode,
    bikeType,
    surfacePref,
    wellLit ? '1' : '0',
    elevationBias,
  ].join('|');
}

export function saveRoutes(signature, routes, routeIdx) {
  if (!signature || !Array.isArray(routes) || routes.length === 0) return;
  try {
    const payload = JSON.stringify({ signature, routeIdx, savedAt: Date.now(), routes });
    if (payload.length > MAX_BYTES) return;
    localStorage.setItem(KEY, payload);
  } catch {
    // Quota exceeded, private mode, storage disabled. Persistence is a
    // convenience — losing it must never break generating a route.
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing left to do */
    }
  }
}

/**
 * @returns {{routes: object[], routeIdx: number} | null} the stored set, but
 *   only when it was produced by exactly these settings and is still fresh.
 */
export function loadRoutes(signature) {
  if (!signature) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw);
    if (saved?.signature !== signature) return null;
    if (!Array.isArray(saved.routes) || saved.routes.length === 0) return null;
    if (!Number.isFinite(saved.savedAt) || Date.now() - saved.savedAt > MAX_AGE_MS) {
      clearRoutes();
      return null;
    }

    // Guard against a half-written or hand-edited entry reaching the map.
    const routes = saved.routes.filter(
      (r) => r && Array.isArray(r.points) && r.points.length > 1
    );
    if (routes.length === 0) return null;

    const routeIdx =
      Number.isInteger(saved.routeIdx) && saved.routeIdx < routes.length ? saved.routeIdx : 0;

    return { routes, routeIdx };
  } catch {
    return null;
  }
}

export function clearRoutes() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
