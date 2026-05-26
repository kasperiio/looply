import { useEffect, useRef } from 'react';
import { useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LOCATE_SVG } from './icons.js';

export function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function DragReporter({ onMapDrag }) {
  const map = useMap();
  useMapEvents({
    dragend() {
      const center = map.getCenter();
      onMapDrag?.(center.lat, center.lng);
    },
  });
  return null;
}

export function DisableDoubleClickZoom() {
  const map = useMap();
  useEffect(() => {
    map.doubleClickZoom.disable();
  }, [map]);
  return null;
}

export function FlyToBounds({ routePoints }) {
  const map = useMap();
  useEffect(() => {
    if (routePoints && routePoints.length > 1) {
      const bounds = L.latLngBounds(routePoints.map(([lat, lng]) => [lat, lng]));
      map.flyToBounds(bounds, { padding: [40, 40], duration: 1.2 });
    }
  }, [routePoints, map]);
  return null;
}

export function FlyToStart({ startPoint, hasRoute }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (startPoint && !prev.current && !hasRoute) {
      map.flyTo([startPoint.lat, startPoint.lng], 14, { duration: 1.5 });
    }
    prev.current = startPoint;
  }, [startPoint, hasRoute, map]);
  return null;
}

export function LocateControl({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    const ctrl = L.control({ position: 'topleft' });

    ctrl.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const btn = L.DomUtil.create('a', '', container);
      btn.title = 'Go to my location';
      btn.setAttribute('role', 'button');
      btn.innerHTML = LOCATE_SVG;
      btn.style.cssText = `
        display:flex;align-items:center;justify-content:center;
        width:30px;height:30px;cursor:pointer;color:#374151;
      `;

      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, 'click', () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(({ coords }) => {
          const { latitude: lat, longitude: lng } = coords;
          map.flyTo([lat, lng], 15, { duration: 1.2 });
          onMapClick(lat, lng);
        });
      });

      return container;
    };

    ctrl.addTo(map);
    return () => ctrl.remove();
  }, [map, onMapClick]);

  return null;
}
