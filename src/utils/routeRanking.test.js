import { describe, it, expect } from 'vitest';
import {
  backtrackFraction,
  requestKey,
  routeSignature,
  sortRoutesByPreferences,
} from './routeRanking.js';

/** Straight line of `n` points heading north from Helsinki, ~11 m apart. */
function line(n, step = 0.0001) {
  return Array.from({ length: n }, (_, i) => [60 + i * step, 24.94, 0]);
}

describe('backtrackFraction', () => {
  it('returns 0 for degenerate input', () => {
    expect(backtrackFraction(null)).toBe(0);
    expect(backtrackFraction([])).toBe(0);
    expect(backtrackFraction(line(3))).toBe(0);
  });

  it('scores a one-way path as no backtracking', () => {
    expect(backtrackFraction(line(400))).toBe(0);
  });

  it('scores a pure out-and-back near 0.5', () => {
    const out = line(400);
    const back = [...out].reverse().slice(1);
    const fraction = backtrackFraction([...out, ...back]);
    expect(fraction).toBeGreaterThan(0.4);
    expect(fraction).toBeLessThanOrEqual(0.5);
  });

  it('scores a clean loop far below an out-and-back', () => {
    // Square loop, ~440 m per side, sampled densely.
    const corners = [[60, 24.94], [60.004, 24.94], [60.004, 24.948], [60, 24.948], [60, 24.94]];
    const loop = [];
    for (let c = 0; c < corners.length - 1; c++) {
      const [aLat, aLng] = corners[c];
      const [bLat, bLng] = corners[c + 1];
      for (let t = 0; t < 100; t++) {
        loop.push([aLat + ((bLat - aLat) * t) / 100, aLng + ((bLng - aLng) * t) / 100, 0]);
      }
    }
    expect(backtrackFraction(loop)).toBeLessThan(0.05);
  });

  it('does not punish a path that merely passes close to itself', () => {
    // Two parallel legs ~50 m apart — outside the 25 m grid cell, so this is
    // legitimate geometry, not a retrace.
    const outbound = line(300);
    const parallel = line(300).reverse().map(([lat, lng, ele]) => [lat, lng + 0.001, ele]);
    expect(backtrackFraction([...outbound, ...parallel])).toBeLessThan(0.05);
  });
});

describe('routeSignature', () => {
  it('labels an empty route', () => {
    expect(routeSignature({ points: [] })).toBe('empty');
    expect(routeSignature(null)).toBe('empty');
  });

  it('matches for identical routes and differs for distinct ones', () => {
    const a = { distance: 10, points: line(50) };
    const b = { distance: 10, points: line(50) };
    const c = { distance: 12, points: line(50) };
    expect(routeSignature(a)).toBe(routeSignature(b));
    expect(routeSignature(a)).not.toBe(routeSignature(c));
  });
});

describe('requestKey', () => {
  // Deliberately not a palindrome: waypoint ORDER changes the route, so the
  // key has to change with it.
  const wps = [[60.17, 24.94], [60.2, 25.0], [60.15, 24.8]];

  it('is stable for identical inputs', () => {
    expect(requestKey(wps, 'running', 'any', false, 50, 0))
      .toBe(requestKey(wps, 'running', 'any', false, 50, 0));
  });

  it('varies with every routing input that changes the result', () => {
    const base = requestKey(wps, 'running', 'any', false, 50, 0);
    expect(requestKey(wps, 'cycling:road', 'any', false, 50, 0)).not.toBe(base);
    expect(requestKey(wps, 'running', 'trail', false, 50, 0)).not.toBe(base);
    expect(requestKey(wps, 'running', 'any', true, 50, 0)).not.toBe(base);
    expect(requestKey(wps, 'running', 'any', false, 80, 0)).not.toBe(base);
    expect(requestKey(wps, 'running', 'any', false, 50, 1)).not.toBe(base);
    expect(requestKey([...wps].reverse(), 'running', 'any', false, 50, 0)).not.toBe(base);
  });

  it('defaults alternativeidx so a bare call is cacheable', () => {
    expect(requestKey(wps, 'running', 'any', false, 50))
      .toBe(requestKey(wps, 'running', 'any', false, 50, 0));
  });
});

describe('sortRoutesByPreferences', () => {
  const loopPoints = line(400);

  const route = (over = {}) => ({
    distance: 10,
    ascent: 60,
    surface: { paved: 1, unpaved: 0, unknown: 0 },
    points: loopPoints,
    ...over,
  });

  const opts = (over = {}) => ({
    targetDistanceKm: 10,
    surfacePref: 'any',
    wellLit: false,
    elevationBias: 50,
    ...over,
  });

  it('passes through a list of one', () => {
    const only = [route()];
    expect(sortRoutesByPreferences(only, opts())).toBe(only);
  });

  it('prefers the route closest to the target distance', () => {
    const near = route({ distance: 10.2 });
    const far = route({ distance: 12.5 });
    expect(sortRoutesByPreferences([far, near], opts())[0]).toBe(near);
  });

  it('drops candidates outside the distance gate', () => {
    const good = route({ distance: 10 });
    const alsoGood = route({ distance: 10.5 });
    const wild = route({ distance: 40 });
    const ranked = sortRoutesByPreferences([wild, good, alsoGood], opts());
    expect(ranked).not.toContain(wild);
    expect(ranked).toHaveLength(2);
  });

  it('keeps everything when the gate would leave fewer than two', () => {
    const wildA = route({ distance: 40 });
    const wildB = route({ distance: 50 });
    expect(sortRoutesByPreferences([wildA, wildB], opts())).toHaveLength(2);
  });

  it('prefers unpaved when the surface preference asks for it', () => {
    const paved = route({ surface: { paved: 1, unpaved: 0, unknown: 0 } });
    const gravel = route({ surface: { paved: 0, unpaved: 1, unknown: 0 } });
    expect(sortRoutesByPreferences([paved, gravel], opts({ surfacePref: 'trail' }))[0])
      .toBe(gravel);
    expect(sortRoutesByPreferences([gravel, paved], opts({ surfacePref: 'paved' }))[0])
      .toBe(paved);
  });

  it('prefers paved when well-lit is on, whatever the surface preference', () => {
    const paved = route({ surface: { paved: 1, unpaved: 0, unknown: 0 } });
    const gravel = route({ surface: { paved: 0, unpaved: 1, unknown: 0 } });
    const ranked = sortRoutesByPreferences(
      [gravel, paved],
      opts({ surfacePref: 'trail', wellLit: true })
    );
    expect(ranked[0]).toBe(paved);
  });

  it('follows the terrain slider toward flat or hilly', () => {
    const flat = route({ ascent: 20 });   // 2 m/km
    const hilly = route({ ascent: 300 }); // 30 m/km, at the hilly ceiling
    expect(sortRoutesByPreferences([hilly, flat], opts({ elevationBias: 0 }))[0]).toBe(flat);
    expect(sortRoutesByPreferences([flat, hilly], opts({ elevationBias: 100 }))[0]).toBe(hilly);
  });

  it('only weights the area target when prioritizeArea is set', () => {
    const areaTarget = { lat: 60.02, lng: 24.94 };
    const shift = (pts, dLat) => pts.map(([lat, lng, ele]) => [lat + dLat, lng, ele]);
    // Identical on distance, surface, terrain and loop quality — the ONLY
    // difference is how close the geometry passes to the area target.
    const near = route({ points: shift(line(400), 0.02) }); // runs through it
    const away = route({ points: shift(line(400), 0.5) });  // ~53 km north

    const ignored = sortRoutesByPreferences([away, near], opts({ areaTarget }));
    expect(ignored[0]).toBe(away); // tie on everything else, original order kept

    const honoured = sortRoutesByPreferences(
      [away, near],
      opts({ areaTarget, prioritizeArea: true })
    );
    expect(honoured[0]).toBe(near);
  });

  it('breaks a score tie on distance error', () => {
    const closer = route({ distance: 10.1 });
    const looser = route({ distance: 9.8 });
    const ranked = sortRoutesByPreferences([looser, closer], opts());
    expect(ranked[0]).toBe(closer);
  });
});
