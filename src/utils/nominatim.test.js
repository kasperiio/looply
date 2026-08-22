import { describe, it, expect } from 'vitest';
import { formatPlace } from './nominatim.js';

describe('formatPlace', () => {
  it('leads with a POI name and uses its street as context', () => {
    const out = formatPlace({
      name: 'Kaivotalo',
      address: { road: 'Kaivokatu', house_number: '10', city: 'Helsinki' },
    });
    expect(out.primary).toBe('Kaivotalo');
    expect(out.secondary).toBe('Kaivokatu 10, Helsinki');
    expect(out.label).toBe('Kaivotalo, Kaivokatu 10, Helsinki');
  });

  it('leads with the street when there is no POI name', () => {
    const out = formatPlace({
      address: { road: 'Mannerheimintie', house_number: '5', city: 'Helsinki' },
    });
    expect(out.primary).toBe('Mannerheimintie 5');
    expect(out.secondary).toBe('Helsinki');
  });

  it('handles a street with no house number', () => {
    const out = formatPlace({ address: { road: 'Mannerheimintie', city: 'Helsinki' } });
    expect(out.primary).toBe('Mannerheimintie');
    expect(out.label).toBe('Mannerheimintie, Helsinki');
  });

  it('falls back through neighbourhood then locality', () => {
    expect(formatPlace({ address: { suburb: 'Kallio', city: 'Helsinki' } }))
      .toMatchObject({ primary: 'Kallio', secondary: 'Helsinki' });
    expect(formatPlace({ address: { city: 'Helsinki' } }))
      .toMatchObject({ primary: 'Helsinki', secondary: '' });
  });

  it('accepts town, village, or municipality as the locality', () => {
    for (const key of ['town', 'village', 'municipality']) {
      expect(formatPlace({ address: { road: 'Kirkkotie', [key]: 'Nurmijärvi' } }).secondary)
        .toBe('Nurmijärvi');
    }
  });

  it('never repeats the primary in the secondary', () => {
    const out = formatPlace({ name: 'Kallio', address: { suburb: 'Kallio', city: 'Helsinki' } });
    expect(out.primary).toBe('Kallio');
    expect(out.secondary).toBe('Helsinki');
    expect(out.label).toBe('Kallio, Helsinki');
  });

  it('does not repeat a locality that equals the neighbourhood', () => {
    const out = formatPlace({
      address: { road: 'Kirkkotie', suburb: 'Espoo', city: 'Espoo' },
    });
    expect(out.secondary).toBe('Espoo');
  });

  it('falls back to the first display_name segment', () => {
    const out = formatPlace({ display_name: 'Töölönlahti, Helsinki, Uusimaa, Finland' });
    expect(out.primary).toBe('Töölönlahti');
  });

  it('degrades to a placeholder rather than throwing', () => {
    expect(formatPlace(null).primary).toBe('Unknown place');
    expect(formatPlace({}).primary).toBe('Unknown place');
    expect(formatPlace({ address: {} }).label).toBe('Unknown place');
  });

  it('omits the separator when there is no context', () => {
    expect(formatPlace({ name: 'Suomenlinna' }).label).toBe('Suomenlinna');
  });
});
