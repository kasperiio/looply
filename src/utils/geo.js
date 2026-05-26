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

export function calcAscentM(points) {
  let ascent = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = (points[i][2] ?? 0) - (points[i - 1][2] ?? 0);
    if (diff > 0) ascent += diff;
  }
  return ascent;
}
