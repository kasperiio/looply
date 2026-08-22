import { describe, it, expect } from 'vitest';
import { haversineKm, calcRouteDistanceKm, calcAscentM } from './geo.js';

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm([60.17, 24.94], [60.17, 24.94])).toBe(0);
  });

  it('measures a known separation', () => {
    // Helsinki → Tampere, ~160 km great-circle
    const km = haversineKm([60.1699, 24.9384], [61.4978, 23.761]);
    expect(km).toBeGreaterThan(155);
    expect(km).toBeLessThan(165);
  });

  it('is symmetric', () => {
    const a = [60.17, 24.94];
    const b = [60.2, 25.01];
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });

  it('shortens a degree of longitude as latitude increases', () => {
    const atEquator = haversineKm([0, 0], [0, 1]);
    const atSixty = haversineKm([60, 0], [60, 1]);
    // cos(60°) = 0.5, so the northern degree spans about half the ground.
    expect(atSixty / atEquator).toBeCloseTo(0.5, 2);
  });
});

describe('calcRouteDistanceKm', () => {
  it('is zero for a single point', () => {
    expect(calcRouteDistanceKm([[60.17, 24.94]])).toBe(0);
  });

  it('sums consecutive legs', () => {
    const pts = [[60.0, 24.0], [60.1, 24.0], [60.2, 24.0]];
    const expected =
      haversineKm(pts[0], pts[1]) + haversineKm(pts[1], pts[2]);
    expect(calcRouteDistanceKm(pts)).toBeCloseTo(expected, 10);
  });
});

describe('calcAscentM', () => {
  const at = (...eles) => eles.map((ele, i) => [60 + i * 0.001, 24, ele]);

  it('returns 0 for fewer than two points', () => {
    expect(calcAscentM([])).toBe(0);
    expect(calcAscentM([[60, 24, 100]])).toBe(0);
  });

  it('ignores quantization wobble below the hysteresis threshold', () => {
    // SRTM 0.25 m steps jittering around a flat 10 m — summing raw positive
    // deltas would report ~1 m of climb here; hysteresis reports none.
    const flat = at(10, 10.25, 10, 10.25, 10, 10.25, 10);
    expect(calcAscentM(flat)).toBe(0);
  });

  it('counts a climb that clears the threshold', () => {
    expect(calcAscentM(at(0, 10))).toBeCloseTo(10, 5);
  });

  it('does not count a descent', () => {
    expect(calcAscentM(at(10, 0))).toBe(0);
  });

  it('counts each leg of a rolling profile once', () => {
    // up 20, down 20, up 20 → 40 m total climb
    expect(calcAscentM(at(0, 20, 0, 20))).toBeCloseTo(40, 5);
  });

  // KNOWN SHORTFALL (see backlog S10): the hysteresis credits a rise only once
  // it clears the threshold above the running low, so the tail of every climb —
  // up to `thresholdM` metres — is never credited. The loss scales with the
  // NUMBER of climbs, not their size: ten 10 m climbs report 90 m, not 100.
  // Pinned here rather than fixed because HILLY_ASCENT_M_PER_KM in
  // routeRanking.js is calibrated against this behaviour.
  it('under-reports a steady climb by up to the threshold', () => {
    const steady = at(...Array.from({ length: 101 }, (_, i) => i));
    expect(calcAscentM(steady)).toBe(99);
  });

  it('loses the tail of each climb on a rolling profile', () => {
    const rolling = [];
    for (let k = 0; k < 10; k++) {
      for (let i = 0; i <= 10; i++) rolling.push(i);
      for (let i = 10; i >= 0; i--) rolling.push(i);
    }
    // True ascent is 100 m across ten 10 m climbs.
    expect(calcAscentM(at(...rolling))).toBe(90);
  });

  it('discards an uncredited rise once the track drops below the baseline', () => {
    // +1 m never clears the 2 m threshold, then the track falls away.
    expect(calcAscentM(at(0, 1, -5))).toBe(0);
  });

  it('honours a custom threshold', () => {
    const rolling = at(0, 5, 0, 5);
    expect(calcAscentM(rolling, 10)).toBe(0);
    expect(calcAscentM(rolling, 1)).toBeCloseTo(10, 5);
  });

  it('treats a missing elevation as zero rather than NaN', () => {
    const mixed = [[60, 24], [60.001, 24, 10], [60.002, 24]];
    expect(Number.isFinite(calcAscentM(mixed))).toBe(true);
    expect(calcAscentM(mixed)).toBeCloseTo(10, 5);
  });
});
