import { describe, it, expect } from 'vitest';
import { classifySegmentSurface, parseSurface } from './surface.js';

describe('classifySegmentSurface', () => {
  it('reads an explicit surface tag first', () => {
    expect(classifySegmentSurface('surface=asphalt')).toBe('paved');
    expect(classifySegmentSurface('surface=gravel')).toBe('unpaved');
  });

  it('lets an explicit surface override the highway inference', () => {
    // A track is normally unpaved, but a tagged asphalt track is paved.
    expect(classifySegmentSurface('highway=track surface=asphalt')).toBe('paved');
    // A residential street is normally paved, but tagged gravel is not.
    expect(classifySegmentSurface('highway=residential surface=gravel')).toBe('unpaved');
  });

  it('infers from the highway class when no surface is tagged', () => {
    expect(classifySegmentSurface('highway=residential')).toBe('paved');
    expect(classifySegmentSurface('highway=cycleway')).toBe('paved');
    expect(classifySegmentSurface('highway=path')).toBe('unpaved');
    expect(classifySegmentSurface('highway=track')).toBe('unpaved');
  });

  it('returns unknown when nothing is classifiable', () => {
    expect(classifySegmentSurface('')).toBe('unknown');
    expect(classifySegmentSurface('bridge=yes')).toBe('unknown');
    expect(classifySegmentSurface('highway=unclassified')).toBe('unknown');
    expect(classifySegmentSurface('surface=woodchips_and_dreams')).toBe('unknown');
  });

  it('survives malformed tag strings', () => {
    expect(classifySegmentSurface('=asphalt')).toBe('unknown');
    expect(classifySegmentSurface('surface')).toBe('unknown');
    expect(classifySegmentSurface('  highway=path  ')).toBe('unpaved');
  });
});

describe('parseSurface', () => {
  const header = ['Longitude', 'Latitude', 'Distance', 'WayTags'];
  const row = (dist, tags) => ['0', '0', String(dist), tags];

  it('returns null without usable messages', () => {
    expect(parseSurface(null)).toBeNull();
    expect(parseSurface([])).toBeNull();
    expect(parseSurface([header])).toBeNull();
    expect(parseSurface([['Longitude', 'Latitude'], row(100, 'highway=path')])).toBeNull();
  });

  it('weights each category by distance, not by row count', () => {
    const messages = [
      header,
      row(900, 'surface=asphalt'),
      row(100, 'surface=gravel'),
    ];
    const { paved, unpaved, unknown } = parseSurface(messages);
    expect(paved).toBeCloseTo(0.9, 5);
    expect(unpaved).toBeCloseTo(0.1, 5);
    expect(unknown).toBeCloseTo(0, 5);
  });

  it('always returns fractions that sum to 1', () => {
    const messages = [
      header,
      row(500, 'surface=asphalt'),
      row(300, 'highway=track'),
      row(200, 'bridge=yes'),
    ];
    const { paved, unpaved, unknown } = parseSurface(messages);
    expect(paved + unpaved + unknown).toBeCloseTo(1, 10);
    expect(unknown).toBeCloseTo(0.2, 5);
  });

  it('treats an unparseable distance as a single unit rather than NaN', () => {
    const messages = [header, row('n/a', 'surface=asphalt'), row(1, 'surface=gravel')];
    const result = parseSurface(messages);
    expect(result.paved).toBeCloseTo(0.5, 5);
    expect(result.unpaved).toBeCloseTo(0.5, 5);
  });

  it('falls back to equal weighting when there is no Distance column', () => {
    const noDist = ['Longitude', 'Latitude', 'WayTags'];
    const messages = [noDist, ['0', '0', 'surface=asphalt'], ['0', '0', 'surface=gravel']];
    const { paved, unpaved } = parseSurface(messages);
    expect(paved).toBeCloseTo(0.5, 5);
    expect(unpaved).toBeCloseTo(0.5, 5);
  });
});
