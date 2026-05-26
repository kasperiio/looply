import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { haversineKm } from '../utils/circularRoute';
import {
  SURFACE_LABEL,
  SURFACE_CLASS,
  SURFACE_COLOR,
  ELEVATION_CHART_MARGIN,
  ELEVATION_CHART_Y_AXIS_WIDTH,
  ELEVATION_CHART_LEFT_GUTTER_PX,
  ELEVATION_CHART_RIGHT_GUTTER_PX,
} from '../constants/surface.js';

function segmentDistanceKm(seg) {
  const pts = seg.points;
  if (!pts || pts.length < 2) return 0;
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
  return km;
}

/**
 * Surface strips sized by route distance (same scale as the elevation X axis).
 */
function SurfaceTimeline({ segments, hoverProgress }) {
  if (!segments?.length) return null;

  const segmentDists = segments.map(segmentDistanceKm);
  const totalKm = segmentDists.reduce((sum, d) => sum + d, 0);
  if (totalKm <= 0) return null;

  return (
    <div
      className="shrink-0 mb-1"
      style={{
        paddingLeft: `${ELEVATION_CHART_LEFT_GUTTER_PX}px`,
        paddingRight: `${ELEVATION_CHART_RIGHT_GUTTER_PX}px`,
      }}
    >
      <div className="relative h-1.5">
        <div className="flex h-full rounded-full overflow-hidden">
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                width: `${(segmentDists[i] / totalKm) * 100}%`,
                backgroundColor: SURFACE_COLOR[seg.surface] ?? SURFACE_COLOR.unknown,
              }}
            />
          ))}
        </div>
        {hoverProgress != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-white/90 rounded-full pointer-events-none"
            style={{ left: `clamp(0px, ${hoverProgress * 100}%, 100%)` }}
          />
        )}
      </div>
    </div>
  );
}

function hoverProgressFromChartState(state, data) {
  const { activeTooltipIndex, activeCoordinate, offset } = state ?? {};
  const plotLeft = offset?.left;
  const plotWidth = offset?.width;
  const cursorX = activeCoordinate?.x;

  if (
    Number.isFinite(plotLeft) &&
    Number.isFinite(plotWidth) &&
    plotWidth > 0 &&
    Number.isFinite(cursorX)
  ) {
    return Math.min(1, Math.max(0, (cursorX - plotLeft) / plotWidth));
  }

  const idx = activeTooltipIndex;
  const totalDist = data[data.length - 1]?.dist ?? 0;
  if (idx == null || totalDist <= 0) return null;
  return data[idx].dist / totalDist;
}

/**
 * Builds chart data: cumulative distance (km) vs elevation (m).
 */
function buildChartData(points, segments = []) {
  if (!points || points.length === 0) return [];

  const pointSurfaces = buildPointSurfaceMap(points, segments);
  const data = [];
  let cumDist = 0;
  let cumAscent = 0;
  let cumDescent = 0;
  data.push({
    idx: 0,
    dist: 0,
    ele: Math.round(points[0][2] ?? 0),
    grade: 0,
    ascent: 0,
    descent: 0,
    surface: pointSurfaces[0],
  });

  for (let i = 1; i < points.length; i++) {
    const stepKm = haversineKm(points[i - 1], points[i]);
    cumDist += stepKm;
    const eleDiff = (points[i][2] ?? 0) - (points[i - 1][2] ?? 0);
    if (eleDiff > 0) cumAscent += eleDiff;
    if (eleDiff < 0) cumDescent += Math.abs(eleDiff);

    // Local grade (%): elevation delta / horizontal distance.
    const grade = stepKm > 0.001 ? (eleDiff / (stepKm * 1000)) * 100 : 0;
    data.push({
      idx: i,
      dist: parseFloat(cumDist.toFixed(2)),
      ele: Math.round(points[i][2] ?? 0),
      grade: parseFloat(grade.toFixed(1)),
      ascent: Math.round(cumAscent),
      descent: Math.round(cumDescent),
      surface: pointSurfaces[i],
    });
  }
  return data;
}

function buildPointSurfaceMap(points, segments) {
  const map = Array(points.length).fill('unknown');
  if (!segments?.length || points.length === 0) return map;

  const totalPts = segments.reduce((sum, seg) => sum + (seg.points?.length ?? 0), 0);
  if (totalPts <= 0) return map;

  let cursor = 0;
  for (const seg of segments) {
    const segLen = seg.points?.length ?? 0;
    if (segLen <= 0) continue;
    const start = cursor;
    const end = Math.min(points.length - 1, cursor + segLen - 1);
    for (let i = start; i <= end; i++) map[i] = seg.surface ?? 'unknown';
    cursor = Math.max(cursor + segLen - 1, cursor + 1); // shared endpoint between segments
    if (cursor >= points.length) break;
  }
  return map;
}

const CustomTooltip = ({ active, payload, totalDistanceKm }) => {
  if (active && payload && payload.length) {
    const row = payload[0].payload;
    const gradeSign = row.grade > 0 ? '+' : '';
    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded-md px-2.5 py-2 text-[11px] leading-tight shadow-xl min-w-44">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-lime-300 font-semibold">{row.ele} m</span>
          <span className="text-gray-400">{row.dist.toFixed(2)} km</span>
        </div>
        <div className="text-gray-400 flex items-center justify-between gap-2">
          <span>Grade</span>
          <span className="text-gray-200">{gradeSign}{row.grade.toFixed(1)}%</span>
        </div>
        <div className="text-gray-400 flex items-center justify-between gap-2">
          <span>Climbed / Desc.</span>
          <span className="text-gray-200">{row.ascent}m / {row.descent}m</span>
        </div>
        <div className="text-gray-400 flex items-center justify-between gap-2">
          <span>Remaining</span>
          <span className="text-gray-200">{Math.max(0, totalDistanceKm - row.dist).toFixed(2)} km</span>
        </div>
        <div className="text-gray-400 flex items-center justify-between gap-2">
          <span>Surface</span>
          <span className={SURFACE_CLASS[row.surface] ?? SURFACE_CLASS.unknown}>
            {SURFACE_LABEL[row.surface] ?? SURFACE_LABEL.unknown}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

/**
 * @param {Array}    points        - route points [[lat,lng,ele],…]
 * @param {Array}    segments      - route segments with surface info
 * @param {Function} onHoverPoint  - called with {lat,lng} while hovering, null on leave
 */
export default function ElevationChart({ points, segments = [], onHoverPoint }) {
  const [hoverProgress, setHoverProgress] = useState(null);
  const data = buildChartData(points, segments);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-xs">
        Generate a route to see elevation profile
      </div>
    );
  }

  const minEle = Math.min(...data.map((d) => d.ele));
  const maxEle = Math.max(...data.map((d) => d.ele));

  const handleMouseMove = (state) => {
    const progress = hoverProgressFromChartState(state, data);
    setHoverProgress(progress);

    if (!onHoverPoint) return;
    const idx = state?.activeTooltipIndex;
    if (idx == null || !points?.[idx]) return;

    const [lat, lng] = points[idx];
    onHoverPoint({
      lat,
      lng,
      progress: progress ?? 0,
      ele: data[idx].ele,
      dist: data[idx].dist,
      surface: data[idx].surface,
    });
  };

  const handleMouseLeave = () => {
    setHoverProgress(null);
    onHoverPoint?.(null);
  };

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      <SurfaceTimeline segments={segments} hoverProgress={hoverProgress} />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={ELEVATION_CHART_MARGIN}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a3e635" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#a3e635" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="dist"
          type="number"
          domain={[0, data[data.length - 1].dist]}
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: '#1f2937' }}
          tickFormatter={(v) => `${v}km`}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[Math.max(0, minEle - 20), maxEle + 20]}
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}m`}
          width={ELEVATION_CHART_Y_AXIS_WIDTH}
        />
        <Tooltip content={<CustomTooltip totalDistanceKm={data[data.length - 1].dist} />} />
        <Area
          type="monotone"
          dataKey="ele"
          stroke="#a3e635"
          strokeWidth={2}
          fill="url(#eleGrad)"
          dot={false}
          activeDot={{ r: 3, fill: '#a3e635', stroke: '#030712' }}
        />
      </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
