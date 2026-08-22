import { haversineKm, calcRouteDistanceKm, calcAscentM } from '../geo.js';
import { classifySegmentSurface, parseSurface } from './surface.js';

/**
 * Index of the route point closest to (lat, lng).
 *
 * Manhattan distance is enough here — this only ranks candidates, and the
 * points are dense — but the longitude term has to be scaled by cos(lat) or a
 * degree of longitude counts the same as a degree of latitude. At 60°N that is
 * ~56 km judged against ~111 km, which biases every break toward whichever
 * point differs in latitude rather than the one that is actually nearest.
 */
function nearestPointIndex(points, lat, lng) {
  const lngScale = Math.cos((lat * Math.PI) / 180);
  let minD = Infinity;
  let idx = 0;
  for (let i = 0; i < points.length; i++) {
    const d =
      Math.abs(points[i][0] - lat) + Math.abs(points[i][1] - lng) * lngScale;
    if (d < minD) {
      minD = d;
      idx = i;
    }
  }
  return idx;
}

/**
 * Remove genuine out-and-back spikes: BRouter routes exactly to each via
 * point, so an off-road waypoint produces a dead-end detour that reverses
 * over the same coordinates (…A→B→apex→B→A…). Detect the apex where the
 * path folds back on itself and cut the symmetric retrace around it.
 *
 * Unlike proximity-based pruning, this never amputates legitimate geometry
 * that merely passes close to itself (parallel paths, tight loop necks).
 */
function pruneSpurs(points) {
  const APEX_KM = 0.01; // pts[i−1] ≈ pts[i+1]: the path folds at i
  const MATCH_KM = 0.02; // outward/return legs must match this closely

  const pts = [...points];
  let i = 1;

  // Single forward pass. Cutting a spur can only create a new fold at the
  // junction it leaves behind — every index below that was already cleared and
  // its neighbourhood is untouched — so the scan resumes there instead of
  // restarting from the top. Restarting made this quadratic, which is real
  // main-thread time on a long ride with many off-road waypoints.
  while (i < pts.length - 1) {
    if (haversineKm(pts[i - 1], pts[i + 1]) > APEX_KM) {
      i += 1;
      continue;
    }

    let k = 1;
    while (
      i - k - 1 >= 0 &&
      i + k + 1 < pts.length &&
      haversineKm(pts[i - k - 1], pts[i + k + 1]) <= MATCH_KM
    ) {
      k += 1;
    }

    // pts[i−k] ≈ pts[i+k] is the verified junction; keep the outward copy
    // and drop everything through the returning copy so the path stays
    // continuous. That is the 2k points at i−k+1 … i+k.
    pts.splice(i - k + 1, 2 * k);
    i = Math.max(1, i - k);
  }

  return pts;
}

function buildSegments(points, messages) {
  const fallback = [{ points, surface: 'unknown' }];
  if (!Array.isArray(messages) || messages.length < 2 || points.length < 2) return fallback;

  const hdr = messages[0];
  const lngIdx = hdr.indexOf('Longitude');
  const latIdx = hdr.indexOf('Latitude');
  const tagIdx = hdr.indexOf('WayTags');
  if (lngIdx < 0 || latIdx < 0 || tagIdx < 0) return fallback;

  const breaks = messages.slice(1).map((row) => ({
    idx: nearestPointIndex(points, parseFloat(row[latIdx]) / 1e6, parseFloat(row[lngIdx]) / 1e6),
    surface: classifySegmentSurface(row[tagIdx] ?? ''),
  })).sort((a, b) => a.idx - b.idx);

  if (breaks.length === 0) return fallback;

  const segments = [];
  for (let m = 0; m < breaks.length; m++) {
    const start = breaks[m].idx;
    const end = m + 1 < breaks.length ? breaks[m + 1].idx + 1 : points.length;
    const surface = breaks[m].surface;
    if (end > start + 1) {
      if (segments.length > 0 && segments[segments.length - 1].surface === surface) {
        segments[segments.length - 1].points = [
          ...segments[segments.length - 1].points,
          ...points.slice(start + 1, end),
        ];
      } else {
        segments.push({ points: points.slice(start, end), surface });
      }
    }
  }

  if (breaks[0].idx > 0) {
    const leadSurface = segments[0]?.surface ?? 'unknown';
    if (segments.length > 0 && segments[0].surface === leadSurface) {
      segments[0] = {
        points: [...points.slice(0, breaks[0].idx + 1), ...segments[0].points.slice(1)],
        surface: leadSurface,
      };
    } else {
      segments.unshift({ points: points.slice(0, breaks[0].idx + 1), surface: 'unknown' });
    }
  }

  return segments.filter((s) => s.points.length >= 2);
}

export function parseGeoJson(geojson) {
  const feature = geojson.features?.[0];
  if (!feature) throw new Error('BRouter returned no route features');

  const coords = feature.geometry.coordinates;
  const raw = coords.map(([lng, lat, ele]) => [lat, lng, ele ?? 0]);
  const points = pruneSpurs(raw);
  const props = feature.properties || {};

  const distance = calcRouteDistanceKm(points);
  // Derived from the pruned points, not props['filtered ascend'] — that value
  // is computed on the pre-prune geometry and under-reports by ~3x.
  const ascent = calcAscentM(points);
  const surface = parseSurface(props.messages);
  const segments = buildSegments(points, props.messages);

  return { points, distance, ascent, surface, segments };
}
