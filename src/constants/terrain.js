/**
 * Terrain slider vocabulary.
 *
 * The visible label and the value announced to a screen reader have to be the
 * same words, so both read from here rather than each inlining the thresholds.
 */
export function terrainLabel(elevationBias) {
  if (elevationBias < 33) return 'Flat';
  if (elevationBias < 67) return 'Mixed';
  return 'Hilly';
}
