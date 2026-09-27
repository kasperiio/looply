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

/**
 * One-tap targets. Race distances are what runners actually type in, and a
 * 21.1 km half is unreachable on a 0.5 km slider grid.
 */
const PRESETS_KM_BY_MODE = {
  running: [5, 10, 15, 21.1, 42.2],
  cycling: [20, 40, 60, 80, 100],
};

export function distancePresetsKm(mode) {
  return PRESETS_KM_BY_MODE[mode] ?? PRESETS_KM_BY_MODE.running;
}

/** Fine-adjust increment for the −/+ stepper and the slider's snap grid. */
export function distanceStepKm(mode) {
  return mode === 'cycling' ? 1 : 0.5;
}

// Slider position runs 0…SLIDER_RESOLUTION. A linear 1–50 km track gives a
// phone about 3.5 px per 0.5 km, so everything a typical run needs is crammed
// into the first fifth. Squaring the position spends half the track on the
// shortest quarter of the range.
export const SLIDER_RESOLUTION = 1000;
const SLIDER_CURVE = 2;

const roundKm = (km) => Math.round(km * 10) / 10;

/** Slider position → distance, snapped to the mode's step grid. */
export function sliderToDistanceKm(position, mode) {
  const max = maxDistanceKm(mode);
  const t = Math.min(1, Math.max(0, position / SLIDER_RESOLUTION));
  const raw = MIN_DISTANCE_KM + (max - MIN_DISTANCE_KM) * Math.pow(t, SLIDER_CURVE);
  const step = distanceStepKm(mode);
  return clampDistanceKm(roundKm(Math.round(raw / step) * step), mode);
}

/** Distance → slider position (inverse of sliderToDistanceKm, unsnapped). */
export function distanceToSlider(distance, mode) {
  const max = maxDistanceKm(mode);
  const t = (clampDistanceKm(distance, mode) - MIN_DISTANCE_KM) / (max - MIN_DISTANCE_KM);
  return Math.round(Math.pow(t, 1 / SLIDER_CURVE) * SLIDER_RESOLUTION);
}

/**
 * Next grid value in `direction` (±1). Snaps rather than adding the step, so
 * + from a 21.1 km preset lands on 21.5, not 21.6.
 */
export function stepDistanceKm(distance, direction, mode) {
  const step = distanceStepKm(mode);
  const units = distance / step;
  const next = direction > 0
    ? (Math.floor(units + 1e-9) + 1) * step
    : (Math.ceil(units - 1e-9) - 1) * step;
  return clampDistanceKm(roundKm(next), mode);
}
