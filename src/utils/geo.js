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
 *
 * A climb is banked when the track drops more than the threshold BELOW the
 * running high, which is what confirms the high was a real summit rather than
 * a sampling spike — and at the end of the track, since a route can finish
 * mid-climb.
 *
 * Crediting each rise as soon as it cleared the threshold (the previous
 * approach) looked equivalent but silently discarded the last few metres of
 * every climb: the remainder below the threshold was never banked, so the
 * shortfall scaled with the NUMBER of climbs rather than their size. Ten 10 m
 * climbs reported 90 m, which is worst exactly on the rolling terrain where
 * the number matters most.
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
    } else if (ele < high - thresholdM) {
      // Confirmed descent from `high`: bank the climb that led up to it.
      if (high - low > thresholdM) ascent += high - low;
      low = ele;
      high = ele;
    }
    // Between those: within the threshold below the high, i.e. noise.

    // `low` must keep tracking the true bottom regardless of which branch ran.
    // Resetting it only on a confirmed descent stranded it partway down —
    // the last few metres of each valley went uncounted, so the NEXT climb
    // was measured from too high a base.
    if (ele < low) low = ele;
  }

  // The track can simply end partway up a climb.
  if (high - low > thresholdM) ascent += high - low;

  return ascent;
}
