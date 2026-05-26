/** Shared surface styling — map, stats timeline, elevation tooltip */

export const VALID_SURFACE_PREFS = ['paved', 'any', 'trail'];

export const SURFACE_COLOR = {
  paved: '#a3e635',
  unpaved: '#f59e0b',
  unknown: '#94a3b8',
};

export const SURFACE_LABEL = {
  paved: 'Paved',
  unpaved: 'Unpaved',
  unknown: 'Unknown',
};

export const SURFACE_CLASS = {
  paved: 'text-lime-300',
  unpaved: 'text-amber-300',
  unknown: 'text-slate-300',
};

/** Shared with ElevationChart margins — keeps surface timeline aligned with plot area */
export const ELEVATION_CHART_MARGIN = { top: 4, right: 8, left: -16, bottom: 0 };
export const ELEVATION_CHART_Y_AXIS_WIDTH = 48;
export const ELEVATION_CHART_LEFT_GUTTER_PX =
  ELEVATION_CHART_Y_AXIS_WIDTH + ELEVATION_CHART_MARGIN.left;
export const ELEVATION_CHART_RIGHT_GUTTER_PX = ELEVATION_CHART_MARGIN.right;
