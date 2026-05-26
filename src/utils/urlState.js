import { VALID_SURFACE_PREFS } from '../constants/surface.js';

const VALID_MODES = ['running', 'cycling'];
const MIN_DISTANCE_KM = 1;
const MAX_DISTANCE_KM = 50;
const DEFAULT_DISTANCE_KM = 10;
const DEFAULT_ELEVATION_BIAS = 50;

function parseFiniteNumber(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function isFinitePoint(point) {
  return (
    point != null &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  );
}

export function readUrlParams() {
  const p = new URLSearchParams(window.location.search);
  const rawSurface = p.get('surface') ?? 'any';
  const rawMode = p.get('mode');
  const lat = parseFiniteNumber(p.get('lat'));
  const lng = parseFiniteNumber(p.get('lng'));
  const areaLat = parseFiniteNumber(p.get('alat'));
  const areaLng = parseFiniteNumber(p.get('alng'));
  const rawDistance = parseFiniteNumber(p.get('d'));
  const rawElevationBias = parseFiniteNumber(p.get('ele'));

  return {
    lat,
    lng,
    areaLat,
    areaLng,
    distance: rawDistance == null ? DEFAULT_DISTANCE_KM : clamp(rawDistance, MIN_DISTANCE_KM, MAX_DISTANCE_KM),
    mode: VALID_MODES.includes(rawMode) ? rawMode : 'running',
    surfacePref: VALID_SURFACE_PREFS.includes(rawSurface) ? rawSurface : 'any',
    wellLit: p.get('lit') === '1',
    elevationBias: rawElevationBias == null ? DEFAULT_ELEVATION_BIAS : clamp(Math.round(rawElevationBias), 0, 100),
  };
}

export function writeUrlParams(state) {
  const p = new URLSearchParams();
  if (state.startPoint && Number.isFinite(state.startPoint.lat) && Number.isFinite(state.startPoint.lng)) {
    p.set('lat', state.startPoint.lat.toFixed(6));
    p.set('lng', state.startPoint.lng.toFixed(6));
  }
  if (state.areaPoint && Number.isFinite(state.areaPoint.lat) && Number.isFinite(state.areaPoint.lng)) {
    p.set('alat', state.areaPoint.lat.toFixed(6));
    p.set('alng', state.areaPoint.lng.toFixed(6));
  }
  p.set('d', state.distance);
  p.set('mode', state.mode);
  p.set('surface', state.surfacePref);
  p.set('lit', state.wellLit ? '1' : '0');
  p.set('ele', state.elevationBias);
  window.history.replaceState({}, '', `?${p.toString()}`);
}
