import { Polyline, Marker, CircleMarker } from 'react-leaflet';
import { SURFACE_COLOR } from '../../constants/surface.js';
import { startIcon, waypointIcon } from './icons.js';

export default function RouteLayers({
  drawSegments,
  waypoints,
  hoverPoint,
  startPoint,
  onWaypointDrag,
  onRouteDoubleClick,
}) {
  return (
    <>
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
