/**
 * Generates a valid GPX 1.1 XML string from a route.
 * @param {Array<[lat, lng, ele?]>} points - Array of coordinate points
 * @param {string} name - Track name
 * @returns {string} GPX XML string
 */
export function buildGpx(points, name = 'Looply Route') {
  const now = new Date().toISOString();

  const trkpts = points
    .map(([lat, lng, ele]) => {
      const eleTag =
        ele !== undefined && ele !== null
          ? `\n        <ele>${Number(ele).toFixed(1)}</ele>`
          : '';
      return `      <trkpt lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}">${eleTag}\n      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
  creator="Looply"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1
    http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Triggers a browser download of the GPX file.
 */
export function downloadGpx(points, name = 'looply-route') {
  const xml = buildGpx(points, name);
  const blob = new Blob([xml], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
