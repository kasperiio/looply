import {
  Zap, Navigation, Bike, Footprints,
  Sun, MoveHorizontal, Download,
  Loader2, X, Github, Trash2,
} from 'lucide-react';
import { VALID_SURFACE_PREFS } from '../constants/surface.js';
import Toggle from './Toggle.jsx';
import StartPointSearch from './StartPointSearch.jsx';

const SURFACE_OPTIONS = [
  { value: 'paved', label: 'Road', description: 'Asphalt & paved surfaces' },
  { value: 'any', label: 'Any', description: 'Mixed, whatever is available' },
  { value: 'trail', label: 'Unpaved', description: 'Dirt, gravel & footpaths' },
].filter((o) => VALID_SURFACE_PREFS.includes(o.value));

export default function Sidebar({
  startLabel,
  distance,
  mode,
  surfacePref,
  wellLit,
  elevationBias,
  onStartSearch,
  onDistanceChange,
  onModeChange,
  onSurfaceChange,
  onLitToggle,
  onElevationChange,
  onGenerate,
  onClearRoutes,
  onExportGpx,
  loading,
  hasRoute,
  onClose,
}) {
  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-xl tracking-tight leading-none">Looply</h1>
          <p className="text-[10px] text-gray-500 mt-1">v{import.meta.env.VITE_APP_VERSION}</p>
        </div>

        <a
          href="https://github.com/kasperiio"
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="GitHub"
        >
          <Github size={16} />
        </a>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <hr className="border-gray-800" />

      <StartPointSearch startLabel={startLabel} onStartSearch={onStartSearch} />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <Navigation size={11} className="text-lime-400" /> Target Distance
          <span className="ml-auto text-lime-400 font-semibold">{distance} km</span>
        </label>
        <input
          type="range"
          min={1}
          max={50}
          step={0.5}
          value={distance}
          onChange={(e) => onDistanceChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-gray-800 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>1 km</span>
          <span>50 km</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-400">Activity</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['running', Footprints, 'Running'],
            ['cycling', Bike, 'Cycling'],
          ].map(([m, Icon, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                mode === m
                  ? 'bg-lime-400/10 border-lime-400/40 text-lime-300'
                  : 'bg-gray-900/60 border-gray-800 text-gray-500 hover:border-gray-700'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-400">Surface</label>
        <div className="grid grid-cols-3 gap-1.5">
          {SURFACE_OPTIONS.map(({ value, label, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => onSurfaceChange(value)}
              title={description}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-xs font-medium transition-all ${
                surfacePref === value
                  ? 'bg-lime-400/10 border-lime-400/40 text-lime-300'
                  : 'bg-gray-900/60 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              <span className="text-sm leading-none">
                {value === 'paved' ? '🛣️' : value === 'any' ? '🪨' : '🌿'}
              </span>
              <span className="mt-0.5">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Toggle
          label="Well-Lit Roads"
          icon={Sun}
          checked={wellLit}
          onChange={onLitToggle}
          description="Prefer streets with lit=yes (avoids trails)"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <MoveHorizontal size={11} className="text-lime-400" /> Terrain
          <span className="ml-auto text-gray-500 text-[10px]">
            {elevationBias < 33 ? 'Flat' : elevationBias < 67 ? 'Mixed' : 'Hilly'}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={elevationBias}
          onChange={(e) => onElevationChange(parseInt(e.target.value, 10))}
          className="w-full h-1.5 rounded-full appearance-none bg-gray-800 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>Flat</span>
          <span>Hilly</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onGenerate()}
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-lime-400/20"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
        {loading ? 'Generating…' : 'Generate Route'}
      </button>

      {hasRoute && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClearRoutes}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-400/50 hover:text-red-200 text-xs font-medium transition-all"
          >
            <Trash2 size={12} /> Clear
          </button>
          <button
            type="button"
            onClick={onExportGpx}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-700 bg-gray-900/60 text-gray-300 hover:border-gray-600 hover:text-white text-xs font-medium transition-all"
          >
            <Download size={12} /> GPX
          </button>
        </div>
      )}
    </div>
  );
}
