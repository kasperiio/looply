import { haversineKm, calcRouteDistanceKm, calcAscentM } from '../geo.js';
import { classifySegmentSurface, parseSurface } from './surface.js';

function nearestPointIndex(points, lat, lng) {
  let minD = Infinity;
  let idx = 0;
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(points[i][0] - lat) + Math.abs(points[i][1] - lng);
    if (d < minD) {
      minD = d;
      idx = i;
    }
  }
  return idx;
}

function pruneSpurs(points) {
  const PROX_KM = 0.030;
  const MAX_SPUR = 100;
  const SKIP = 20;

  let pts = points;
  let changed = true;

  while (changed) {
    changed = false;
    const n = pts.length;
    outer: for (let i = SKIP; i < n - SKIP; i++) {
      const limit = Math.min(i + MAX_SPUR, n - SKIP);
      for (let j = i + 4; j <= limit; j++) {
        if (haversineKm(pts[i], pts[j]) <= PROX_KM) {
          pts = [...pts.slice(0, i + 1), ...pts.slice(j)];
          changed = true;
          break outer;
        }
      }
    }
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
  const ascent = props['filtered ascend']
    ? parseFloat(props['filtered ascend'])
    : calcAscentM(points);
  const surface = parseSurface(props.messages);
  const segments = buildSegments(points, props.messages);

  return { points, distance, ascent, surface, segments };
}
