/**
 * Target-distance bounds for the slider and for URL state.
 *
 * The ceiling is per mode: a ride covers far more ground than a run, so
 * cycling gets a longer slider. Anything that reads, writes or clamps a target
 * distance goes through here.
 */

export const MIN_DISTANCE_KM = 1;
export const DEFAULT_DISTANCE_KM = 10;

const MAX_DISTANCE_KM_BY_MODE = { running: 50, cycling: 100 };

export function maxDistanceKm(mode) {
  return MAX_DISTANCE_KM_BY_MODE[mode] ?? MAX_DISTANCE_KM_BY_MODE.running;
}

export function clampDistanceKm(distance, mode) {
  return Math.min(maxDistanceKm(mode), Math.max(MIN_DISTANCE_KM, distance));
}
