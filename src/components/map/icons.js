import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export const LOCATE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8" stroke-opacity=".35"/></svg>`;

export const startIcon = L.divIcon({
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#a3e635;border:3px solid #030712;
    box-shadow:0 0 8px #a3e635,0 0 16px rgba(163,230,53,0.4);
  "></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const waypointIcon = L.divIcon({
  html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:#38bdf8;border:2px solid #030712;
    box-shadow:0 0 8px rgba(56,189,248,0.55);
  "></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});
