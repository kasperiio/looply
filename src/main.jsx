import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode is intentionally omitted — react-leaflet's MapContainer
// does not survive the double-mount that StrictMode triggers in dev.
createRoot(document.getElementById('root')).render(<App />)
