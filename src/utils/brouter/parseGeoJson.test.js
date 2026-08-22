import { describe, it, expect } from 'vitest';
import { parseGeoJson } from './parseGeoJson.js';
import { haversineKm } from '../geo.js';

const HEADER = ['Longitude', 'Latitude', 'Distance', 'WayTags'];

/** BRouter reports message coordinates as integer microdegrees. */
const msg = (lat, lng, dist, tags) =>
  [String(Math.round(lng * 1e6)), String(Math.round(lat * 1e6)), String(dist), tags];

/** GeoJSON coordinates are [lng, lat, ele]; the parser flips them to [lat, lng, ele]. */
const geojson = (latLngEle, messages) => ({
  features: [
    {
      geometry: { coordinates: latLngEle.map(([lat, lng, ele = 0]) => [lng, lat, ele]) },
      properties: messages ? { messages } : {},
    },
  ],
});

const straight = (n, ele = () => 0) =>
  Array.from({ length: n }, (_, i) => [60 + i * 0.001, 24.94, ele(i)]);

describe('parseGeoJson', () => {
  it('throws when BRouter returns no features', () => {
    expect(() => parseGeoJson({ features: [] })).toThrow(/no route features/i);
    expect(() => parseGeoJson({})).toThrow(/no route features/i);
  });

  it('flips coordinates to [lat, lng, ele]', () => {
    const { points } = parseGeoJson(geojson([[60.17, 24.94, 12]]));
    expect(points[0]).toEqual([60.17, 24.94, 12]);
  });

  it('defaults a missing elevation to 0 rather than undefined', () => {
    const { points } = parseGeoJson({
      features: [{ geometry: { coordinates: [[24.94, 60.17]] }, properties: {} }],
    });
    expect(points[0]).toEqual([60.17, 24.94, 0]);
  });

  it('derives distance from the pruned geometry', () => {
    const pts = straight(5);
    const { distance } = parseGeoJson(geojson(pts));
    let expected = 0;
    for (let i = 1; i < pts.length; i++) expected += haversineKm(pts[i - 1], pts[i]);
    expect(distance).toBeCloseTo(expected, 10);
  });

  it('derives ascent from the pruned geometry, not from BRouter properties', () => {
    const climbing = straight(11, (i) => i * 5); // 0 → 50 m
    const { ascent } = parseGeoJson({
      features: [
        {
          geometry: {
            coordinates: climbing.map(([lat, lng, ele]) => [lng, lat, ele]),
          },
          // A deliberately wrong BRouter value — it must be ignored.
          properties: { 'filtered ascend': '3' },
        },
      ],
    });
    expect(ascent).toBeGreaterThan(40);
  });

  describe('spur pruning', () => {
    it('leaves a clean route untouched', () => {
      const pts = straight(6);
      expect(parseGeoJson(geojson(pts)).points).toHaveLength(6);
    });

    it('cuts an out-and-back dead-end detour', () => {
      // …P0 P1 P2 → spur east to an apex and back → P7. BRouter routes
      // exactly to each via point, so an off-road waypoint produces this.
      const pts = [
        [60.000, 24.940, 0],
        [60.001, 24.940, 0],
        [60.002, 24.940, 0], // junction
        [60.002, 24.941, 0],
        [60.002, 24.942, 0], // apex — path folds here
        [60.002, 24.941, 0],
        [60.002, 24.940, 0], // back at the junction
        [60.003, 24.940, 0],
      ];
      const { points } = parseGeoJson(geojson(pts));
      expect(points).toHaveLength(4);
      expect(points.map(([lat]) => lat)).toEqual([60.000, 60.001, 60.002, 60.003]);
      // Every remaining point sits on the original main line.
      expect(points.every(([, lng]) => lng === 24.940)).toBe(true);
    });

    it('keeps parallel paths that merely pass close to one another', () => {
      // Out and back on two tracks ~55 m apart — legitimate geometry, and far
      // enough apart that no point folds onto its own neighbour.
      const out = straight(20);
      const back = straight(20).reverse().map(([lat, lng, ele]) => [lat, lng + 0.001, ele]);
      const { points } = parseGeoJson(geojson([...out, ...back]));
      expect(points).toHaveLength(40);
    });

    it('leaves a tight loop neck intact', () => {
      // A loop that returns near its own start but never reverses over itself.
      const loop = [];
      for (let t = 0; t < 60; t++) {
        const a = (t / 60) * 2 * Math.PI;
        loop.push([60 + 0.002 * Math.cos(a), 24.94 + 0.004 * Math.sin(a), 0]);
      }
      loop.push(loop[0]);
      expect(parseGeoJson(geojson(loop)).points).toHaveLength(61);
    });
  });

  describe('segment building', () => {
    it('falls back to one unknown segment without usable messages', () => {
      const { segments } = parseGeoJson(geojson(straight(4)));
      expect(segments).toHaveLength(1);
      expect(segments[0].surface).toBe('unknown');
    });

    it('falls back when the header lacks the columns it needs', () => {
      const { segments } = parseGeoJson(
        geojson(straight(4), [['Longitude', 'Latitude'], ['0', '0']])
      );
      expect(segments).toHaveLength(1);
      expect(segments[0].surface).toBe('unknown');
    });

    it('splits the route where the surface changes', () => {
      const pts = straight(5);
      const { segments } = parseGeoJson(
        geojson(pts, [
          HEADER,
          msg(60.000, 24.94, 200, 'surface=asphalt'),
          msg(60.002, 24.94, 200, 'highway=track'),
        ])
      );
      expect(segments.map((s) => s.surface)).toEqual(['paved', 'unpaved']);
    });

    it('keeps segments continuous, sharing the point at each boundary', () => {
      const pts = straight(5);
      const { segments } = parseGeoJson(
        geojson(pts, [
          HEADER,
          msg(60.000, 24.94, 200, 'surface=asphalt'),
          msg(60.002, 24.94, 200, 'highway=track'),
        ])
      );
      const endOfFirst = segments[0].points.at(-1);
      const startOfSecond = segments[1].points[0];
      expect(startOfSecond).toEqual(endOfFirst);
    });

    it('merges adjacent runs of the same surface', () => {
      const pts = straight(7);
      const { segments } = parseGeoJson(
        geojson(pts, [
          HEADER,
          msg(60.000, 24.94, 100, 'surface=asphalt'),
          msg(60.002, 24.94, 100, 'highway=residential'), // also paved
          msg(60.004, 24.94, 100, 'highway=track'),
        ])
      );
      expect(segments.map((s) => s.surface)).toEqual(['paved', 'unpaved']);
    });

    it('drops degenerate segments shorter than two points', () => {
      const { segments } = parseGeoJson(
        geojson(straight(5), [
          HEADER,
          msg(60.000, 24.94, 100, 'surface=asphalt'),
          msg(60.004, 24.94, 100, 'highway=track'),
        ])
      );
      for (const seg of segments) expect(seg.points.length).toBeGreaterThanOrEqual(2);
    });

    it('covers the whole route across all segments', () => {
      const pts = straight(9);
      const { segments, points } = parseGeoJson(
        geojson(pts, [
          HEADER,
          msg(60.000, 24.94, 100, 'surface=asphalt'),
          msg(60.004, 24.94, 100, 'highway=track'),
        ])
      );
      expect(segments[0].points[0]).toEqual(points[0]);
      expect(segments.at(-1).points.at(-1)).toEqual(points.at(-1));
    });

    it('reports the surface mix alongside the segments', () => {
      const { surface } = parseGeoJson(
        geojson(straight(5), [
          HEADER,
          msg(60.000, 24.94, 750, 'surface=asphalt'),
          msg(60.002, 24.94, 250, 'highway=track'),
        ])
      );
      expect(surface.paved).toBeCloseTo(0.75, 5);
      expect(surface.unpaved).toBeCloseTo(0.25, 5);
    });
  });
});
