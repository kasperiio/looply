import { describe, it, expect } from 'vitest';
import {
  bearingDeg,
  buildCircularWaypoints,
  circleRadius,
  haversineKm,
  pointAlongBearing,
  snapToTrails,
} from './circularRoute.js';

const HELSINKI = [60.17, 24.94];

describe('bearingDeg', () => {
  it('reads cardinal directions', () => {
    // Meridians are great circles, so north/south are exact.
    expect(bearingDeg(HELSINKI, [60.27, 24.94])).toBeCloseTo(0, 1);
    expect(bearingDeg(HELSINKI, [60.07, 24.94])).toBeCloseTo(180, 1);
    // East/west are not: this is the INITIAL bearing of a great circle, and a
    // parallel of latitude is not one. At 60°N a due-east target reads 89.91°,
    // because the shortest path starts by curving poleward.
    expect(bearingDeg(HELSINKI, [60.17, 25.14])).toBeCloseTo(90, 0);
    expect(bearingDeg(HELSINKI, [60.17, 24.74])).toBeCloseTo(270, 0);
  });

  it('always returns a value in [0, 360)', () => {
    for (const target of [[60.27, 24.74], [60.07, 24.74], [60.07, 25.14]]) {
      const b = bearingDeg(HELSINKI, target);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe('pointAlongBearing', () => {
  it('lands the requested distance away', () => {
    const p = pointAlongBearing(...HELSINKI, 45, 5);
    expect(haversineKm(HELSINKI, p)).toBeCloseTo(5, 1);
  });

  it('lands on the requested bearing', () => {
    for (const bearing of [0, 45, 137, 300]) {
      const p = pointAlongBearing(...HELSINKI, bearing, 3);
      expect(bearingDeg(HELSINKI, p)).toBeCloseTo(bearing, 0);
    }
  });
});

describe('circleRadius', () => {
  it('scales linearly with the target distance', () => {
    expect(circleRadius(20, 'paved') / circleRadius(10, 'paved')).toBeCloseTo(2, 5);
  });

  it('shrinks the circle for trails, which detour more per km', () => {
    expect(circleRadius(10, 'trail')).toBeLessThan(circleRadius(10, 'paved'));
  });

  it('falls back to the "any" detour factor for an unknown surface', () => {
    expect(circleRadius(10, 'nonsense')).toBeCloseTo(circleRadius(10, 'any'), 10);
  });

  it('produces a perimeter that matches the target after the detour factor', () => {
    // perimeter = n · 2R · sin(π/n); road distance ≈ detour × perimeter
    const target = 10;
    const n = 5; // 10 km → pentagon
    const R = circleRadius(target, 'paved');
    const perimeter = n * 2 * R * Math.sin(Math.PI / n);
    expect(perimeter * 1.3).toBeCloseTo(target, 5);
  });
});

describe('buildCircularWaypoints', () => {
  it('picks the vertex count from the target distance', () => {
    expect(buildCircularWaypoints(...HELSINKI, 4, 0, 'any')).toHaveLength(3);   // square
    expect(buildCircularWaypoints(...HELSINKI, 10, 0, 'any')).toHaveLength(4);  // pentagon
    expect(buildCircularWaypoints(...HELSINKI, 30, 0, 'any')).toHaveLength(5);  // hexagon
  });

  it('places every vertex on the circle around the offset centre', () => {
    const target = 10;
    const bearing = 0;
    const R = circleRadius(target, 'any');
    const centre = pointAlongBearing(...HELSINKI, bearing, R);
    for (const wp of buildCircularWaypoints(...HELSINKI, target, bearing, 'any')) {
      expect(haversineKm(centre, wp)).toBeCloseTo(R, 1);
    }
  });

  it('keeps the start on the ring, so the loop never becomes a lollipop', () => {
    const target = 10;
    const R = circleRadius(target, 'any');
    const centre = pointAlongBearing(...HELSINKI, 0, R);
    expect(haversineKm(centre, HELSINKI)).toBeCloseTo(R, 1);
  });

  it('extends the loop in the requested direction', () => {
    const north = buildCircularWaypoints(...HELSINKI, 10, 0, 'any');
    const south = buildCircularWaypoints(...HELSINKI, 10, 180, 'any');
    const meanLat = (wps) => wps.reduce((s, [lat]) => s + lat, 0) / wps.length;
    expect(meanLat(north)).toBeGreaterThan(HELSINKI[0]);
    expect(meanLat(south)).toBeLessThan(HELSINKI[0]);
  });

  it('spreads vertices evenly around the ring', () => {
    const target = 10;
    const R = circleRadius(target, 'any');
    const centre = pointAlongBearing(...HELSINKI, 0, R);
    const wps = buildCircularWaypoints(...HELSINKI, target, 0, 'any');
    const angles = [HELSINKI, ...wps].map((p) => bearingDeg(centre, p)).sort((a, b) => a - b);
    const gaps = angles.map((a, i) => (i === 0 ? a + 360 - angles.at(-1) : a - angles[i - 1]));
    for (const gap of gaps) expect(gap).toBeCloseTo(360 / (wps.length + 1), 0);
  });
});

describe('snapToTrails', () => {
  const wps = [[60.20, 24.94], [60.17, 25.00], [60.14, 24.94]];

  it('returns waypoints untouched when there are no trail points', () => {
    expect(snapToTrails(wps, [], 1)).toBe(wps);
  });

  it('leaves a waypoint alone when no trail is within the snap radius', () => {
    const distant = [[61.0, 24.94]];
    expect(snapToTrails(wps, distant, 0.5)).toEqual(wps);
  });

  it('snaps a waypoint to a trail point inside the radius', () => {
    const trail = [[60.201, 24.94]];
    const snapped = snapToTrails(wps, trail, 1);
    expect(snapped[0]).toEqual(trail[0]);
    expect(snapped[1]).toEqual(wps[1]);
  });

  it('never lets two waypoints claim the same trail point', () => {
    // One trail point sits near every waypoint; only the closest may take it.
    const trail = [[60.17, 24.97]];
    const snapped = snapToTrails(wps, trail, 50);
    const claims = snapped.filter((p) => p[0] === trail[0][0] && p[1] === trail[0][1]);
    expect(claims).toHaveLength(1);
  });

  it('preserves waypoint count and order', () => {
    const trail = [[60.201, 24.94], [60.171, 25.001]];
    const snapped = snapToTrails(wps, trail, 1);
    expect(snapped).toHaveLength(wps.length);
    expect(snapped[2]).toEqual(wps[2]);
  });
});
