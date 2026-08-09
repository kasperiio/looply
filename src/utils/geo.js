/** Shared geodesic helpers */

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcRouteDistanceKm(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversineKm(points[i - 1], points[i]);
  }
  return d;
}

// BRouter elevations come from SRTM quantized to 0.25 m steps, so summing every
// positive delta accumulates sampling noise rather than climbing (a flat 12 km
// Helsinki loop spanning 1.75–23 m reports ~113 m that way). Only count a rise
// once it clears this much above the running low.
const ASCENT_HYSTERESIS_M = 2;

/**
 * Total ascent in metres, ignoring wobble below the hysteresis threshold.
 * Computed from the same points we render and export, so the figure is
 * reproducible from the downloaded GPX — BRouter's own `filtered ascend`
 * property is a routing-cost heuristic (~10 m hysteresis) that swallows real
 * climbs and cannot be derived from the track.
 */
export function calcAscentM(points, thresholdM = ASCENT_HYSTERESIS_M) {
  if (!points || points.length < 2) return 0;

  let ascent = 0;
  let low = points[0][2] ?? 0;
  let high = low;

  for (let i = 1; i < points.length; i++) {
    const ele = points[i][2] ?? 0;
    if (ele > high) {
      high = ele;
      if (high - low > thresholdM) {
        ascent += high - low;
        low = high;
      }
    } else if (ele < low) {
      // Dropping below the baseline discards any uncredited rise as noise.
      low = ele;
      high = ele;
    }
  }

  return ascent;
}
