import { describe, it, expect } from 'vitest';
import {
  MIN_DISTANCE_KM,
  SLIDER_RESOLUTION,
  distancePresetsKm,
  distanceToSlider,
  maxDistanceKm,
  sliderToDistanceKm,
  stepDistanceKm,
} from './distance.js';

describe('curved distance slider', () => {
  it('spans the full range at its ends', () => {
    for (const mode of ['running', 'cycling']) {
      expect(sliderToDistanceKm(0, mode)).toBe(MIN_DISTANCE_KM);
      expect(sliderToDistanceKm(SLIDER_RESOLUTION, mode)).toBe(maxDistanceKm(mode));
    }
  });

  it('gives short running distances most of the track', () => {
    // 1–10 km is under a fifth of a linear 1–50 km track.
    expect(distanceToSlider(10, 'running') / SLIDER_RESOLUTION).toBeGreaterThan(0.4);
  });

  it('snaps to the step grid', () => {
    for (let pos = 0; pos <= SLIDER_RESOLUTION; pos += 37) {
      expect(sliderToDistanceKm(pos, 'running') % 0.5).toBeCloseTo(0);
      expect(Number.isInteger(sliderToDistanceKm(pos, 'cycling'))).toBe(true);
    }
  });

  it('round-trips every grid distance', () => {
    for (let km = 1; km <= 50; km += 0.5) {
      expect(sliderToDistanceKm(distanceToSlider(km, 'running'), 'running')).toBe(km);
    }
  });
});

describe('stepDistanceKm', () => {
  it('moves one step and snaps off-grid presets onto the grid', () => {
    expect(stepDistanceKm(10, 1, 'running')).toBe(10.5);
    expect(stepDistanceKm(10, -1, 'running')).toBe(9.5);
    expect(stepDistanceKm(21.1, 1, 'running')).toBe(21.5);
    expect(stepDistanceKm(21.1, -1, 'running')).toBe(21);
    expect(stepDistanceKm(40, 1, 'cycling')).toBe(41);
  });

  it('stops at the bounds', () => {
    expect(stepDistanceKm(MIN_DISTANCE_KM, -1, 'running')).toBe(MIN_DISTANCE_KM);
    expect(stepDistanceKm(maxDistanceKm('running'), 1, 'running')).toBe(maxDistanceKm('running'));
  });
});

describe('distancePresetsKm', () => {
  it('only offers reachable targets', () => {
    for (const mode of ['running', 'cycling']) {
      for (const km of distancePresetsKm(mode)) {
        expect(km).toBeGreaterThanOrEqual(MIN_DISTANCE_KM);
        expect(km).toBeLessThanOrEqual(maxDistanceKm(mode));
      }
    }
  });
});
