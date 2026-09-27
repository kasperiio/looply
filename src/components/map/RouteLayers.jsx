import { useMemo } from 'react';
import { Polyline, Marker, CircleMarker } from 'react-leaflet';
import { calcRouteDistanceKm, markersAlongRoute } from '../../utils/geo.js';
import { SURFACE_COLOR } from '../../constants/surface.js';
import { directionIcon, startIcon, waypointIcon } from './icons.js';

// About one arrow per km, within limits that keep a 2 km loop readable and a
// 100 km ride from turning into a dotted line.
const MIN_ARROWS = 4;
const MAX_ARROWS = 14;

export default function RouteLayers({
  drawSegments,
  previews = [],
  waypoints,
  hoverPoint,
  startPoint,
  onWaypointDrag,
  onRouteDoubleClick,
}) {
  const arrows = useMemo(() => {
    const points = drawSegments.flatMap((s) => s.points);
    const count = Math.min(MAX_ARROWS, Math.max(MIN_ARROWS, Math.round(calcRouteDistanceKm(points))));
    return markersAlongRoute(points, count).map((m) => ({ ...m, icon: directionIcon(m.bearing) }));
  }, [drawSegments]);

  return (
    <>
      {/* Loops the search has found so far. Faint and inert on purpose: they
          show progress, not a result — nothing here is clickable or ranked. */}
      {previews.map((pts, i) => (
        <Polyline
          key={`preview-${i}`}
          positions={pts.map(([lat, lng]) => [lat, lng])}
          pathOptions={{ color: '#a3e635', weight: 2.5, opacity: 0.35, interactive: false }}
        />
      ))}

      {drawSegments.map(({ points: pts, surface }, i) => (
        <Polyline
          key={`glow-${i}`}
          positions={pts.map(([lat, lng]) => [lat, lng])}
          pathOptions={{
            color: SURFACE_COLOR[surface] ?? SURFACE_COLOR.unknown,
            weight: 10,
            opacity: 0.12,
          }}
        />
      ))}

      {drawSegments.map(({ points: pts, surface }, i) => (
        <Polyline
          key={`line-${i}`}
          positions={pts.map(([lat, lng]) => [lat, lng])}
          pathOptions={{
            color: SURFACE_COLOR[surface] ?? SURFACE_COLOR.unknown,
            weight: 3.5,
            opacity: 0.95,
          }}
          eventHandlers={{
            dblclick: (e) => {
              e.originalEvent?.preventDefault?.();
              e.originalEvent?.stopPropagation?.();
              onRouteDoubleClick?.(e.latlng.lat, e.latlng.lng);
            },
          }}
        />
      ))}

      {arrows.map(({ lat, lng, icon }, i) => (
        <Marker
          key={`dir-${i}`}
          position={[lat, lng]}
          icon={icon}
          interactive={false}
          keyboard={false}
        />
      ))}

      {waypoints.map((wp, idx) => (
        <Marker
          key={`wp-${idx}-${wp.lat.toFixed(6)}-${wp.lng.toFixed(6)}`}
          position={[wp.lat, wp.lng]}
          icon={waypointIcon}
          draggable
          // Leaflet makes markers keyboard-focusable, so without a name these
          // are a row of anonymous buttons in the accessibility tree. Naming
          // them does not make them draggable by keyboard — that is a separate
          // piece of work — but it does say what they are.
          title={`Route waypoint ${idx + 1} of ${waypoints.length} — drag to reshape`}
          alt={`Route waypoint ${idx + 1} of ${waypoints.length}`}
          eventHandlers={{
            dragend: (e) => {
              const pos = e.target.getLatLng();
              onWaypointDrag?.(idx, pos.lat, pos.lng);
            },
          }}
        />
      ))}

      {hoverPoint && (
        <>
          <CircleMarker
            center={[hoverPoint.lat, hoverPoint.lng]}
            radius={9}
            pathOptions={{ color: '#a3e635', fillColor: '#a3e635', fillOpacity: 0.15, weight: 1.5 }}
          />
          <CircleMarker
            center={[hoverPoint.lat, hoverPoint.lng]}
            radius={5}
            pathOptions={{ color: '#030712', fillColor: '#a3e635', fillOpacity: 1, weight: 2 }}
          />
        </>
      )}

      {startPoint && (
        <Marker
          position={[startPoint.lat, startPoint.lng]}
          icon={startIcon}
          title="Start and finish point"
          alt="Start and finish point"
        />
      )}
    </>
  );
}
