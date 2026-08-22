import {
  Zap, Navigation, Bike, Footprints,
  Sun, MoveHorizontal,
  Loader2, X, Github,
} from 'lucide-react';
import { VALID_SURFACE_PREFS } from '../constants/surface.js';
import { MIN_DISTANCE_KM, maxDistanceKm } from '../constants/distance.js';
import Toggle from './Toggle.jsx';
import OptionGroup from './OptionGroup.jsx';
import StartPointSearch from './StartPointSearch.jsx';
import { terrainLabel } from '../constants/terrain.js';

const SURFACE_OPTIONS = [
  { value: 'paved', label: 'Road', description: 'Asphalt & paved surfaces', emoji: '🛣️' },
  { value: 'any', label: 'Any', description: 'Mixed, whatever is available', emoji: '🪨' },
  { value: 'trail', label: 'Unpaved', description: 'Dirt, gravel & footpaths', emoji: '🌿' },
].filter((o) => VALID_SURFACE_PREFS.includes(o.value));

const BIKE_TYPE_OPTIONS = [
  { value: 'road', label: 'Road', description: 'Fast riding on asphalt', emoji: '🚴' },
  { value: 'gravel', label: 'Gravel', description: 'Forest roads & smooth gravel tracks', emoji: '🪨' },
  { value: 'mtb', label: 'MTB', description: 'Singletrack & technical trails', emoji: '⛰️' },
];

const ACTIVITY_OPTIONS = [
  { value: 'running', label: 'Running', icon: Footprints },
  { value: 'cycling', label: 'Cycling', icon: Bike },
];

export default function Sidebar({
  startLabel,
  distance,
  mode,
  bikeType,
  surfacePref,
  wellLit,
  elevationBias,
  onStartSearch,
  onDistanceChange,
  onModeChange,
  onBikeTypeChange,
  onSurfaceChange,
  onLitToggle,
  onElevationChange,
  onGenerate,
  loading,
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
          href="https://github.com/kasperiio/looply"
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
        <label htmlFor="looply-distance" className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <Navigation size={11} className="text-lime-400" aria-hidden="true" /> Target Distance
          <span className="ml-auto text-lime-400 font-semibold">{distance} km</span>
        </label>
        <input
          id="looply-distance"
          type="range"
          min={MIN_DISTANCE_KM}
          max={maxDistanceKm(mode)}
          step={0.5}
          value={distance}
          /* Without this a screen reader announces the bare number "10". */
          aria-valuetext={`${distance} kilometres`}
          onChange={(e) => onDistanceChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-gray-800 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>{MIN_DISTANCE_KM} km</span>
          <span>{maxDistanceKm(mode)} km</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-gray-400">Activity</span>
        <OptionGroup
          label="Activity"
          options={ACTIVITY_OPTIONS}
          selected={mode}
          onSelect={onModeChange}
          columns={2}
        />
      </div>

      {mode === 'cycling' ? (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-400">Bike</span>
          <OptionGroup
            label="Bike type"
            options={BIKE_TYPE_OPTIONS}
            selected={bikeType}
            onSelect={onBikeTypeChange}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-400">Surface</span>
          <OptionGroup
            label="Surface preference"
            options={SURFACE_OPTIONS}
            selected={surfacePref}
            onSelect={onSurfaceChange}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Toggle
          label="Well-Lit Roads"
          icon={Sun}
          checked={wellLit}
          onChange={onLitToggle}
          description="Prefer lit streets & paths"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="looply-terrain" className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <MoveHorizontal size={11} className="text-lime-400" aria-hidden="true" /> Terrain
          <span className="ml-auto text-gray-500 text-[10px]">{terrainLabel(elevationBias)}</span>
        </label>
        <input
          id="looply-terrain"
          type="range"
          min={0}
          max={100}
          step={1}
          value={elevationBias}
          /* "50" means nothing spoken aloud; "Mixed" is the actual setting. */
          aria-valuetext={terrainLabel(elevationBias)}
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
    </div>
  );
}
