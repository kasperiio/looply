/**
 * Circular route waypoint builder — adaptive polygon approach.
 *
 * WHY NOT A TRIANGLE?
 * With n=3 waypoints, BRouter routes the path from V1→V2 via the road that
 * passes closest to the center (start point), because the straight-line
 * V1→V2 chord slices through the interior. This turns the intended triangle
 * into a spoke pattern — much shorter than the target distance.
 *
 * FIX — n=5 (pentagon) for most distances:
 * Adjacent pentagon vertices are only 72° apart. Their connecting chord
 * never cuts through the center, so BRouter has to actually traverse the
 * outer arc. This produces genuine circular routes with far less variance.
 *
 * RADIUS CALIBRATION:
 * We account for the road-network "detour factor" (road distance ÷
 * straight-line distance): ~1.3 for paved roads, ~1.5 for trails.
 * Route Euclidean length = 2R × (1 + (n−1) × sin(π/n))
 * Setting road_distance ≈ detour × Euclidean = targetKm gives:
 *   R = targetKm / (detour × 2 × (1 + (n−1) × sin(π/n)))
 */

import { haversineKm as haversineKmGeo } from './geo.js';

const DEG_PER_KM   = 1 / 111.32; // approx degrees latitude per km
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** Road-network detour factors per surface preference. */
const ROAD_DETOUR = { paved: 1.3, any: 1.35, trail: 1.5 };

/**
 * Waypoint (polygon vertex) count by target distance.
 * More vertices → rounder loop, harder for BRouter to shortcut.
 *   ≤ 5 km  → 4 (square)
 *   ≤ 20 km → 5 (pentagon)  ← handles most running distances
 *   > 20 km → 6 (hexagon)   ← longer rides need even more vertices
 */
function numVertices(targetKm) {
  if (targetKm <=  5) return 4;
  if (targetKm <= 20) return 5;
  return 6;
}

/**
 * Offset a lat/lng by dx km (east) and dy km (north).
 */
function offsetPoint(lat, lng, dxKm, dyKm) {
  const dLat = dyKm * DEG_PER_KM;
  const dLng = dxKm * DEG_PER_KM / Math.cos((lat * Math.PI) / 180);
  return [lat + dLat, lng + dLng];
}

/** Initial bearing in degrees from point A to point B. */
export function bearingDeg([lat1, lng1], [lat2, lng2]) {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const lambda1 = (lng1 * Math.PI) / 180;
  const lambda2 = (lng2 * Math.PI) / 180;
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Project a point from [lat,lng] along a bearing for distanceKm. */
export function pointAlongBearing(lat, lng, bearing, distanceKm) {
  const angle = (bearing * Math.PI) / 180;
  const dx = distanceKm * Math.sin(angle);
  const dy = distanceKm * Math.cos(angle);
  return offsetPoint(lat, lng, dx, dy);
}

/**
 * Build n waypoints on a regular polygon around (lat, lng), calibrated so
 * that BRouter's actual road distance ≈ targetKm.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} targetKm     - desired total route distance
 * @param {number} bearing      - rotation offset in degrees (0 = first vertex north)
 * @param {string} surfacePref  - 'paved' | 'any' | 'trail'
 */
export function buildCircularWaypoints(lat, lng, targetKm, bearing = 0, surfacePref = 'any') {
  const n  = numVertices(targetKm);
  const df = ROAD_DETOUR[surfacePref] ?? 1.35;

  // Euclidean factor for n-gon route (start→v0→v1→…→v(n-1)→start):
  //   = 2R + (n−1)×2R×sin(π/n) = 2R×(1 + (n−1)×sin(π/n))
  const euclideanFactor = 2 * (1 + (n - 1) * Math.sin(Math.PI / n));
  const R = targetKm / (df * euclideanFactor);

  const step   = (2 * Math.PI) / n;
  const offset = (bearing  * Math.PI) / 180;

  return Array.from({ length: n }, (_, i) => {
    const angle = offset + i * step;
    return offsetPoint(lat, lng, R * Math.sin(angle), R * Math.cos(angle));
  });
}

/**
 * Compute the circumradius used for a given target distance and surface.
 * Exposed so callers can derive snap radii without duplicating the formula.
 */
export function circleRadius(targetKm, surfacePref = 'any') {
  const n  = numVertices(targetKm);
  const df = ROAD_DETOUR[surfacePref] ?? 1.35;
  return targetKm / (df * 2 * (1 + (n - 1) * Math.sin(Math.PI / n)));
}

/** Haversine distance in km between two [lat, lng] points. */
export const haversineKm = haversineKmGeo;

/**
 * Query Overpass for nodes that lie ON nearby trail ways (highway=track /
 * highway=path / highway=bridleway).
 *
 * Using `node(w)` gives us actual coordinates on navigable paths rather than
 * bounding-box centres, so snapping produces waypoints that BRouter can
 * actually reach via those trails.
 *
 * Returns up to 200 node points as [[lat, lng], …], sorted nearest-first.
 * Returns [] silently on any network / parse / timeout failure so callers
 * always fall back to geometric waypoints without breaking route gen.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm  Search radius (capped at 12 km internally).
 */
export async function findNearbyTrailPoints(lat, lng, radiusKm) {
  const r = Math.round(Math.min(radiusKm, 12) * 1000);
  const query = [
    '[out:json][timeout:20];',
    '(',
    `  way["highway"~"^(track|path|bridleway)$"](around:${r},${lat},${lng});`,
    ');',
    'node(w);',
    'out 200;',
  ].join('');

  try {
    const res = await fetch(OVERPASS_URL, { method: 'POST', body: query });
    if (!res.ok) return [];
    const { elements = [] } = await res.json();
    return elements
      .filter(el => el.type === 'node' && el.lat != null && el.lon != null)
      .map(el => [el.lat, el.lon])
      .sort((a, b) => haversineKm(a, [lat, lng]) - haversineKm(b, [lat, lng]));
  } catch {
    return []; // network failure, rate-limit, timeout — silently fall back
  }
}

/**
 * Snap each geometric waypoint to the nearest unused trail point within
 * snapRadiusKm.  Each trail point can only be claimed by one waypoint so the
 * three vertices stay spread around the loop rather than collapsing together.
 * Waypoints with no trail nearby are returned unchanged (geometric position).
 *
 * @param {Array<[lat,lng]>} waypoints    Geometric triangle vertices.
 * @param {Array<[lat,lng]>} trailPoints  Centers from findNearbyTrailPoints.
 * @param {number}           snapRadiusKm Max snap distance per waypoint.
 */
export function snapToTrails(waypoints, trailPoints, snapRadiusKm) {
  if (!trailPoints.length) return waypoints;

  const claimed = new Set();

  return waypoints.map(([wLat, wLng]) => {
    let bestIdx  = -1;
    let bestDist = Infinity;

    for (let i = 0; i < trailPoints.length; i++) {
      if (claimed.has(i)) continue;
      const d = haversineKm([wLat, wLng], trailPoints[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    if (bestIdx >= 0 && bestDist <= snapRadiusKm) {
      claimed.add(bestIdx);
      return trailPoints[bestIdx];
    }
    return [wLat, wLng]; // no close trail — keep geometric position
  });
}
