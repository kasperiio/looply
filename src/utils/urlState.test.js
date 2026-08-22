import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isFinitePoint, readUrlParams, writeUrlParams } from './urlState.js';

/** Minimal window stub — urlState only touches location.search and history. */
function setSearch(search) {
  vi.stubGlobal('window', {
    location: { search },
    history: { replaceState: vi.fn() },
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('isFinitePoint', () => {
  it('accepts a finite lat/lng pair', () => {
    expect(isFinitePoint({ lat: 60.17, lng: 24.94 })).toBe(true);
    expect(isFinitePoint({ lat: 0, lng: 0 })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isFinitePoint(null)).toBe(false);
    expect(isFinitePoint(undefined)).toBe(false);
    expect(isFinitePoint({})).toBe(false);
    expect(isFinitePoint({ lat: 60.17 })).toBe(false);
    expect(isFinitePoint({ lat: NaN, lng: 24.94 })).toBe(false);
    expect(isFinitePoint({ lat: Infinity, lng: 24.94 })).toBe(false);
    expect(isFinitePoint({ lat: '60.17', lng: '24.94' })).toBe(false);
  });
});

describe('readUrlParams', () => {
  it('supplies defaults for an empty query string', () => {
    setSearch('');
    expect(readUrlParams()).toEqual({
      lat: null,
      lng: null,
      areaLat: null,
      areaLng: null,
      distance: 10,
      mode: 'running',
      bikeType: 'road',
      surfacePref: 'any',
      wellLit: false,
      elevationBias: 50,
    });
  });

  it('round-trips a full set of parameters', () => {
    setSearch('?lat=60.17&lng=24.94&alat=60.2&alng=25.0&d=25&mode=cycling&bike=gravel&surface=trail&lit=1&ele=80');
    expect(readUrlParams()).toMatchObject({
      lat: 60.17,
      lng: 24.94,
      areaLat: 60.2,
      areaLng: 25.0,
      distance: 25,
      mode: 'cycling',
      bikeType: 'gravel',
      surfacePref: 'trail',
      wellLit: true,
      elevationBias: 80,
    });
  });

  it('migrates legacy mtb-as-a-mode URLs', () => {
    setSearch('?mode=mtb');
    const { mode, bikeType } = readUrlParams();
    expect(mode).toBe('cycling');
    expect(bikeType).toBe('mtb');
  });

  it('clamps distance to the ceiling for the resolved mode', () => {
    setSearch('?mode=running&d=90');
    expect(readUrlParams().distance).toBe(50);
    setSearch('?mode=cycling&d=90');
    expect(readUrlParams().distance).toBe(90);
    setSearch('?mode=cycling&d=500');
    expect(readUrlParams().distance).toBe(100);
    setSearch('?d=0');
    expect(readUrlParams().distance).toBe(1);
  });

  it('clamps and rounds the elevation bias', () => {
    setSearch('?ele=-40');
    expect(readUrlParams().elevationBias).toBe(0);
    setSearch('?ele=140');
    expect(readUrlParams().elevationBias).toBe(100);
    setSearch('?ele=62.7');
    expect(readUrlParams().elevationBias).toBe(63);
  });

  it('falls back to defaults for junk values', () => {
    setSearch('?mode=teleport&bike=unicycle&surface=lava&d=abc&ele=xyz&lat=NaN&lng=');
    expect(readUrlParams()).toMatchObject({
      mode: 'running',
      bikeType: 'road',
      surfacePref: 'any',
      distance: 10,
      elevationBias: 50,
      lat: null,
      lng: null,
    });
  });

  it('treats any lit value other than "1" as off', () => {
    setSearch('?lit=true');
    expect(readUrlParams().wellLit).toBe(false);
    setSearch('?lit=1');
    expect(readUrlParams().wellLit).toBe(true);
  });
});

describe('writeUrlParams', () => {
  const read = () => {
    const [, , url] = window.history.replaceState.mock.calls.at(-1);
    return new URLSearchParams(url.replace(/^\?/, ''));
  };

  it('writes every setting', () => {
    setSearch('');
    writeUrlParams({
      startPoint: { lat: 60.17, lng: 24.94 },
      areaPoint: { lat: 60.2, lng: 25.0 },
      distance: 12,
      mode: 'cycling',
      bikeType: 'mtb',
      surfacePref: 'trail',
      wellLit: true,
      elevationBias: 70,
    });
    const p = read();
    expect(p.get('lat')).toBe('60.170000');
    expect(p.get('alat')).toBe('60.200000');
    expect(p.get('d')).toBe('12');
    expect(p.get('mode')).toBe('cycling');
    expect(p.get('bike')).toBe('mtb');
    expect(p.get('surface')).toBe('trail');
    expect(p.get('lit')).toBe('1');
    expect(p.get('ele')).toBe('70');
  });

  it('omits points that are absent or non-finite', () => {
    setSearch('');
    writeUrlParams({
      startPoint: null,
      areaPoint: { lat: NaN, lng: 25.0 },
      distance: 10,
      mode: 'running',
      bikeType: 'road',
      surfacePref: 'any',
      wellLit: false,
      elevationBias: 50,
    });
    const p = read();
    expect(p.has('lat')).toBe(false);
    expect(p.has('alat')).toBe(false);
  });

  it('survives a read-back through readUrlParams', () => {
    setSearch('');
    writeUrlParams({
      startPoint: { lat: 60.17, lng: 24.94 },
      areaPoint: null,
      distance: 22,
      mode: 'cycling',
      bikeType: 'gravel',
      surfacePref: 'paved',
      wellLit: true,
      elevationBias: 30,
    });
    const [, , url] = window.history.replaceState.mock.calls.at(-1);
    setSearch(url);
    expect(readUrlParams()).toMatchObject({
      lat: 60.17,
      lng: 24.94,
      distance: 22,
      mode: 'cycling',
      bikeType: 'gravel',
      surfacePref: 'paved',
      wellLit: true,
      elevationBias: 30,
    });
  });
});
