import { describe, it, expect } from 'vitest';
import {
  insertWaypointByRouteOrder,
  scatterWaypointsAlongRoute,
  withEditableWaypoints,
} from './routeEditing.js';

/** 101 points running north; index i sits at lat 60 + i/1000. */
const LINE = Array.from({ length: 101 }, (_, i) => [60 + i * 0.001, 24.94, 0]);
const at = (i) => ({ lat: LINE[i][0], lng: LINE[i][1] });

describe('scatterWaypointsAlongRoute', () => {
  it('returns nothing for a route too short to shape', () => {
    expect(scatterWaypointsAlongRoute(null)).toEqual([]);
    expect(scatterWaypointsAlongRoute([])).toEqual([]);
    expect(scatterWaypointsAlongRoute([[60, 24], [60.1, 24]])).toEqual([]);
  });

  it('places nine interior handles at the default 10% step', () => {
    const wps = scatterWaypointsAlongRoute(LINE);
    expect(wps).toHaveLength(9);
  });

  it('never places a handle on the start or the end', () => {
    const wps = scatterWaypointsAlongRoute(LINE);
    expect(wps[0]).not.toEqual({ lat: LINE[0][0], lng: LINE[0][1] });
    expect(wps.at(-1)).not.toEqual({ lat: LINE.at(-1)[0], lng: LINE.at(-1)[1] });
  });

  it('spaces handles evenly along the route', () => {
    const wps = scatterWaypointsAlongRoute(LINE);
    wps.forEach((wp, k) => expect(wp.lat).toBeCloseTo(60 + (k + 1) * 0.01, 6));
  });

  it('honours a custom step', () => {
    expect(scatterWaypointsAlongRoute(LINE, 0.25)).toHaveLength(3);
    expect(scatterWaypointsAlongRoute(LINE, 0.5)).toHaveLength(1);
  });

  it('emits plain {lat, lng} objects', () => {
    for (const wp of scatterWaypointsAlongRoute(LINE)) {
      expect(Object.keys(wp).sort()).toEqual(['lat', 'lng']);
    }
  });
});

describe('withEditableWaypoints', () => {
  it('attaches handles without disturbing the routed result', () => {
    const route = { points: LINE, distance: 10, ascent: 50, surface: {}, segments: [] };
    const shaped = withEditableWaypoints(route);
    expect(shaped.points).toBe(route.points);
    expect(shaped.distance).toBe(10);
    expect(shaped.ascent).toBe(50);
    expect(shaped.waypoints).toHaveLength(9);
  });

  it('does not mutate its input', () => {
    const route = { points: LINE, distance: 10 };
    withEditableWaypoints(route);
    expect(route.waypoints).toBeUndefined();
  });
});

describe('insertWaypointByRouteOrder', () => {
  const route = (waypoints) => ({ points: LINE, waypoints });

  it('appends when the route has no waypoints yet', () => {
    const added = { lat: 60.05, lng: 24.94 };
    expect(insertWaypointByRouteOrder(route([]), added)).toEqual([added]);
  });

  it('appends when there is no geometry to order against', () => {
    const added = { lat: 60.05, lng: 24.94 };
    const existing = [at(20)];
    expect(insertWaypointByRouteOrder({ points: [], waypoints: existing }, added))
      .toEqual([...existing, added]);
  });

  it('tolerates a missing route object', () => {
    const added = { lat: 60.05, lng: 24.94 };
    expect(insertWaypointByRouteOrder(null, added)).toEqual([added]);
    expect(insertWaypointByRouteOrder({}, added)).toEqual([added]);
  });

  it('inserts between the two waypoints it falls between', () => {
    const existing = [at(20), at(60)];
    const added = at(40);
    const next = insertWaypointByRouteOrder(route(existing), added);
    expect(next).toHaveLength(3);
    expect(next[1]).toBe(added);
  });

  it('inserts at the front when it precedes every waypoint', () => {
    const existing = [at(50), at(80)];
    const added = at(10);
    expect(insertWaypointByRouteOrder(route(existing), added)[0]).toBe(added);
  });

  it('appends when it follows every waypoint', () => {
    const existing = [at(20), at(50)];
    const added = at(90);
    expect(insertWaypointByRouteOrder(route(existing), added).at(-1)).toBe(added);
  });

  it('keeps waypoints in route order, not click order', () => {
    let waypoints = [at(30), at(70)];
    waypoints = insertWaypointByRouteOrder(route(waypoints), at(90));
    waypoints = insertWaypointByRouteOrder(route(waypoints), at(10));
    waypoints = insertWaypointByRouteOrder(route(waypoints), at(50));
    const lats = waypoints.map((w) => w.lat);
    expect(lats).toEqual([...lats].sort((a, b) => a - b));
  });

  it('does not mutate the existing waypoint array', () => {
    const existing = [at(20), at(60)];
    insertWaypointByRouteOrder(route(existing), at(40));
    expect(existing).toHaveLength(2);
  });
});
