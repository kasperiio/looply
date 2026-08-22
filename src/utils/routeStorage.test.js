import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { clearRoutes, loadRoutes, routeSetSignature, saveRoutes } from './routeStorage.js';

/** Minimal localStorage stand-in; `failOn` forces a throw to test the guards. */
function installStorage({ failOn = null } = {}) {
  const store = new Map();
  const api = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      if (failOn === 'set') {
        const e = new Error('QuotaExceededError');
        e.name = 'QuotaExceededError';
        throw e;
      }
      store.set(k, v);
    },
    removeItem: (k) => { store.delete(k); },
    _store: store,
  };
  vi.stubGlobal('localStorage', api);
  return api;
}

const SETTINGS = {
  startPoint: { lat: 60.17, lng: 24.94 },
  areaPoint: null,
  distance: 10,
  mode: 'running',
  bikeType: 'road',
  surfacePref: 'any',
  wellLit: false,
  elevationBias: 50,
};

const ROUTES = [
  { distance: 10.1, ascent: 80, points: [[60.17, 24.94, 0], [60.18, 24.95, 5], [60.17, 24.94, 0]] },
  { distance: 9.8, ascent: 60, points: [[60.17, 24.94, 0], [60.16, 24.93, 3], [60.17, 24.94, 0]] },
];

beforeEach(() => { installStorage(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('routeSetSignature', () => {
  it('is null without a start point', () => {
    expect(routeSetSignature({ ...SETTINGS, startPoint: null })).toBeNull();
  });

  it('is stable for identical settings', () => {
    expect(routeSetSignature(SETTINGS)).toBe(routeSetSignature({ ...SETTINGS }));
  });

  it('changes with every input that changes the routes', () => {
    const base = routeSetSignature(SETTINGS);
    expect(routeSetSignature({ ...SETTINGS, distance: 11 })).not.toBe(base);
    expect(routeSetSignature({ ...SETTINGS, mode: 'cycling' })).not.toBe(base);
    expect(routeSetSignature({ ...SETTINGS, bikeType: 'gravel' })).not.toBe(base);
    expect(routeSetSignature({ ...SETTINGS, surfacePref: 'trail' })).not.toBe(base);
    expect(routeSetSignature({ ...SETTINGS, wellLit: true })).not.toBe(base);
    expect(routeSetSignature({ ...SETTINGS, elevationBias: 80 })).not.toBe(base);
    expect(routeSetSignature({ ...SETTINGS, startPoint: { lat: 60.2, lng: 24.94 } })).not.toBe(base);
    expect(routeSetSignature({ ...SETTINGS, areaPoint: { lat: 60.2, lng: 25.0 } })).not.toBe(base);
  });

  it('ignores coordinate noise below ~1 m', () => {
    const a = routeSetSignature(SETTINGS);
    const b = routeSetSignature({ ...SETTINGS, startPoint: { lat: 60.1700000004, lng: 24.94 } });
    expect(a).toBe(b);
  });
});

describe('saveRoutes / loadRoutes', () => {
  it('round-trips a result set', () => {
    const sig = routeSetSignature(SETTINGS);
    saveRoutes(sig, ROUTES, 1);
    const loaded = loadRoutes(sig);
    expect(loaded.routes).toHaveLength(2);
    expect(loaded.routeIdx).toBe(1);
    expect(loaded.routes[0].distance).toBe(10.1);
    expect(loaded.routes[0].points).toEqual(ROUTES[0].points);
  });

  it('refuses a set saved under different settings', () => {
    saveRoutes(routeSetSignature(SETTINGS), ROUTES, 0);
    expect(loadRoutes(routeSetSignature({ ...SETTINGS, distance: 12 }))).toBeNull();
  });

  it('returns null for a null signature or an empty store', () => {
    expect(loadRoutes(null)).toBeNull();
    expect(loadRoutes(routeSetSignature(SETTINGS))).toBeNull();
  });

  it('ignores an empty or non-array route list', () => {
    const sig = routeSetSignature(SETTINGS);
    saveRoutes(sig, [], 0);
    expect(loadRoutes(sig)).toBeNull();
  });

  it('expires an entry older than the freshness window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
    const sig = routeSetSignature(SETTINGS);
    saveRoutes(sig, ROUTES, 0);
    expect(loadRoutes(sig)).not.toBeNull();

    vi.setSystemTime(new Date('2026-08-09T00:00:00Z')); // 8 days later
    expect(loadRoutes(sig)).toBeNull();
    expect(localStorage.getItem('looply.lastRoutes')).toBeNull(); // and is cleaned up
  });

  it('drops routes without usable geometry', () => {
    const sig = routeSetSignature(SETTINGS);
    saveRoutes(sig, [{ distance: 5 }, { distance: 6, points: [[60, 24, 0]] }, ROUTES[0]], 0);
    const loaded = loadRoutes(sig);
    expect(loaded.routes).toHaveLength(1);
    expect(loaded.routes[0].distance).toBe(10.1);
  });

  it('clamps an out-of-range routeIdx rather than selecting nothing', () => {
    const sig = routeSetSignature(SETTINGS);
    saveRoutes(sig, ROUTES, 9);
    expect(loadRoutes(sig).routeIdx).toBe(0);
  });

  it('survives a corrupt entry', () => {
    localStorage.setItem('looply.lastRoutes', '{not json');
    expect(loadRoutes(routeSetSignature(SETTINGS))).toBeNull();
  });

  it('skips a payload beyond the size cap instead of throwing', () => {
    const sig = routeSetSignature(SETTINGS);
    const huge = [{
      distance: 10,
      points: Array.from({ length: 200000 }, (_, i) => [60 + i * 1e-6, 24.94, 0]),
    }];
    expect(() => saveRoutes(sig, huge, 0)).not.toThrow();
    expect(loadRoutes(sig)).toBeNull();
  });

  it('does not throw when storage rejects the write', () => {
    installStorage({ failOn: 'set' });
    const sig = routeSetSignature(SETTINGS);
    expect(() => saveRoutes(sig, ROUTES, 0)).not.toThrow();
    expect(loadRoutes(sig)).toBeNull();
  });

  it('does not throw when localStorage is unavailable entirely', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveRoutes('sig', ROUTES, 0)).not.toThrow();
    expect(loadRoutes('sig')).toBeNull();
    expect(() => clearRoutes()).not.toThrow();
  });
});

describe('clearRoutes', () => {
  it('removes a stored set', () => {
    const sig = routeSetSignature(SETTINGS);
    saveRoutes(sig, ROUTES, 0);
    clearRoutes();
    expect(loadRoutes(sig)).toBeNull();
  });
});
