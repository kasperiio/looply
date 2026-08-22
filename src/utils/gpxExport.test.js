// @vitest-environment jsdom
// Needs a DOM for DOMParser: the point of these tests is that the exported
// GPX actually parses, not merely that it contains the right substrings.
import { describe, it, expect } from 'vitest';
import { buildGpx } from './gpxExport.js';

const PTS = [
  [60.170000, 24.940000, 12.3],
  [60.171000, 24.941000, 15.8],
  [60.172000, 24.942000, 11.1],
];

describe('buildGpx', () => {
  it('emits a well-formed GPX 1.1 document', () => {
    const xml = buildGpx(PTS);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('version="1.1"');
    expect(xml).toContain('creator="Looply"');
    expect(xml).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(xml.trimEnd().endsWith('</gpx>')).toBe(true);
  });

  it('parses as valid XML', () => {
    const doc = new DOMParser().parseFromString(buildGpx(PTS), 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.tagName).toBe('gpx');
  });

  it('writes one trkpt per point, in order', () => {
    const doc = new DOMParser().parseFromString(buildGpx(PTS), 'application/xml');
    const trkpts = [...doc.querySelectorAll('trkpt')];
    expect(trkpts).toHaveLength(3);
    expect(trkpts[0].getAttribute('lat')).toBe('60.1700000');
    expect(trkpts[0].getAttribute('lon')).toBe('24.9400000');
    expect(trkpts.at(-1).getAttribute('lat')).toBe('60.1720000');
  });

  it('includes elevation when present', () => {
    const doc = new DOMParser().parseFromString(buildGpx(PTS), 'application/xml');
    expect([...doc.querySelectorAll('ele')].map((e) => e.textContent))
      .toEqual(['12.3', '15.8', '11.1']);
  });

  it('omits the ele tag when a point has no elevation', () => {
    const xml = buildGpx([[60.17, 24.94], [60.18, 24.95]]);
    expect(xml).not.toContain('<ele>');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
  });

  it('keeps an elevation of exactly 0', () => {
    // 0 is falsy — a truthiness check here would silently drop sea level.
    const xml = buildGpx([[60.17, 24.94, 0]]);
    expect(xml).toContain('<ele>0.0</ele>');
  });

  it('escapes XML metacharacters in the track name', () => {
    const xml = buildGpx(PTS, 'Kalle & "Ærø" <loop>');
    expect(xml).toContain('Kalle &amp; &quot;Ærø&quot; &lt;loop&gt;');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('trk > name').textContent).toBe('Kalle & "Ærø" <loop>');
  });

  it('cannot be broken out of by a hostile name', () => {
    const xml = buildGpx(PTS, '</name></trk><trk><name>injected');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('trk')).toHaveLength(1);
  });

  it('stamps an ISO 8601 metadata time', () => {
    const doc = new DOMParser().parseFromString(buildGpx(PTS), 'application/xml');
    const time = doc.querySelector('metadata > time').textContent;
    expect(time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('handles an empty track without producing invalid XML', () => {
    const doc = new DOMParser().parseFromString(buildGpx([]), 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('trkpt')).toHaveLength(0);
  });
});
