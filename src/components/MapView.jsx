import { MapContainer, TileLayer } from 'react-leaflet';
import {
  ClickHandler,
  DragReporter,
  DisableDoubleClickZoom,
  FlyToBounds,
  FlyToStart,
  LocateControl,
} from './map/controls.jsx';
import RouteLayers from './map/RouteLayers.jsx';

export default function MapView({
  startPoint,
  routePoints,
  segments,
  waypoints = [],
  hoverPoint,
  onMapClick,
  onMapDrag,
  onWaypointDrag,
  onRouteDoubleClick,
}) {
  const hasRoute = routePoints && routePoints.length > 1;

  const drawSegments =
    segments && segments.length > 0
      ? segments
      : hasRoute
        ? [{ points: routePoints, surface: 'paved' }]
        : [];

  return (
    <MapContainer
      center={[20, 0]}
      zoom={3}
      style={{ height: '100%', width: '100%' }}
      zoomControl
      attributionControl
      doubleClickZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={20}
      />

      <ClickHandler onMapClick={onMapClick} />
      <DragReporter onMapDrag={onMapDrag} />
      <DisableDoubleClickZoom />
      <FlyToBounds routePoints={routePoints} />
      <FlyToStart startPoint={startPoint} hasRoute={hasRoute} />
      <LocateControl onMapClick={onMapClick} />

      <RouteLayers
        drawSegments={drawSegments}
        waypoints={waypoints}
        hoverPoint={hoverPoint}
        startPoint={startPoint}
        onWaypointDrag={onWaypointDrag}
        onRouteDoubleClick={onRouteDoubleClick}
      />
    </MapContainer>
  );
}
