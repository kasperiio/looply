import { createRoot } from 'react-dom/client'
// Bundled rather than pulled from unpkg at runtime: a CDN outage would
// otherwise render the map unstyled, and it is one less third-party origin
// executing on the page. Must precede index.css so Tailwind's base layer
// still wins where the two overlap.
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

// StrictMode is intentionally omitted — react-leaflet's MapContainer
// does not survive the double-mount that StrictMode triggers in dev.
createRoot(document.getElementById('root')).render(<App />)
