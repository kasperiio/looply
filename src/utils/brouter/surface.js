const PAVED_SURFACES = new Set([
  'paved', 'asphalt', 'chipseal', 'concrete', 'concrete:lanes', 'concrete:plates',
  'paving_stones', 'paving_stones:lanes', 'sett', 'cobblestone', 'cobblestone:flattened',
  'unhewn_cobblestone', 'bricks', 'grass_paver', 'metal', 'metal_grid', 'wood',
  'stepping_stones', 'tiles', 'tartan', 'acrylic',
]);

const UNPAVED_SURFACES = new Set([
  'unpaved', 'compacted', 'fine_gravel', 'gravel', 'pebblestone', 'shells',
  'ground', 'dirt', 'earth', 'soil', 'mud', 'grass', 'sand', 'rock',
  'woodchips', 'snow', 'ice', 'salt', 'clay',
]);

const INFER_PAVED_HIGHWAYS = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link',
  'primary', 'primary_link', 'secondary', 'secondary_link',
  'tertiary', 'tertiary_link', 'residential', 'living_street', 'service',
  'pedestrian', 'cycleway',
]);

const INFER_UNPAVED_HIGHWAYS = new Set([
  'track', 'path', 'footway', 'bridleway', 'steps',
]);

export function classifySegmentSurface(wayTags) {
  const tags = {};
  for (const kv of wayTags.split(' ')) {
    const eq = kv.indexOf('=');
    if (eq > 0) tags[kv.slice(0, eq)] = kv.slice(eq + 1);
  }
  if (tags.surface) {
    if (PAVED_SURFACES.has(tags.surface)) return 'paved';
    if (UNPAVED_SURFACES.has(tags.surface)) return 'unpaved';
  }
  if (tags.highway) {
    if (INFER_PAVED_HIGHWAYS.has(tags.highway)) return 'paved';
    if (INFER_UNPAVED_HIGHWAYS.has(tags.highway)) return 'unpaved';
  }
  return 'unknown';
}

export function parseSurface(messages) {
  if (!Array.isArray(messages) || messages.length < 2) return null;
  const header = messages[0];
  const wayTagsIdx = header.indexOf('WayTags');
  const distIdx = header.indexOf('Distance');
  if (wayTagsIdx < 0) return null;

  let paved = 0;
  let unpaved = 0;
  let unknown = 0;
  for (let i = 1; i < messages.length; i++) {
    const row = messages[i];
    const tags = row[wayTagsIdx] ?? '';
    const dist = distIdx >= 0 ? (parseFloat(row[distIdx]) || 1) : 1;
    const cat = classifySegmentSurface(tags);
    if (cat === 'paved') paved += dist;
    else if (cat === 'unpaved') unpaved += dist;
    else unknown += dist;
  }
  const total = paved + unpaved + unknown;
  if (total === 0) return null;
  return { paved: paved / total, unpaved: unpaved / total, unknown: unknown / total };
}
