import { Minus, Navigation, Plus } from 'lucide-react';
import {
  MIN_DISTANCE_KM,
  SLIDER_RESOLUTION,
  distancePresetsKm,
  distanceToSlider,
  maxDistanceKm,
  sliderToDistanceKm,
  stepDistanceKm,
} from '../constants/distance.js';

const RACE_LABELS = { 21.1: 'Half', 42.2: 'Full' };

function presetLabel(km, mode) {
  if (mode === 'running') return RACE_LABELS[km] ?? `${km}K`;
  return `${km}`;
}

/**
 * Target distance: presets for the common cases, a stepper for exact values,
 * and a curved slider for sweeping. A bare 1–100 km slider left a phone with
 * under 2 px per step and a thumb smaller than a fingertip.
 */
export default function DistanceControl({ distance, mode, onChange }) {
  const max = maxDistanceKm(mode);
  const presets = distancePresetsKm(mode);

  // Arrow keys would move the slider one of SLIDER_RESOLUTION units, which
  // usually snaps back to the same distance — keyboard users would be stuck.
  const onSliderKeyDown = (e) => {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    onChange(stepDistanceKm(distance, dir, mode));
  };

  const stepButton = (dir, Icon, label) => {
    const atLimit = dir < 0 ? distance <= MIN_DISTANCE_KM : distance >= max;
    return (
      <button
        type="button"
        onClick={() => onChange(stepDistanceKm(distance, dir, mode))}
        disabled={atLimit}
        aria-label={label}
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg border border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-700 active:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Icon size={16} aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <label htmlFor="looply-distance" className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
        <Navigation size={11} className="text-lime-400" aria-hidden="true" /> Target Distance
      </label>

      <div className="flex items-center gap-2">
        {stepButton(-1, Minus, 'Decrease distance')}
        <output
          htmlFor="looply-distance"
          aria-live="polite"
          className="flex-1 text-center text-lime-400 font-semibold text-xl tabular-nums"
        >
          {distance} <span className="text-sm text-lime-400/70">km</span>
        </output>
        {stepButton(1, Plus, 'Increase distance')}
      </div>

      <input
        id="looply-distance"
        type="range"
        min={0}
        max={SLIDER_RESOLUTION}
        step={1}
        value={distanceToSlider(distance, mode)}
        /* Without this a screen reader announces the slider position, not km. */
        aria-valuetext={`${distance} kilometres`}
        onChange={(e) => onChange(sliderToDistanceKm(parseInt(e.target.value, 10), mode))}
        onKeyDown={onSliderKeyDown}
        className="looply-range w-full"
      />

      <div role="group" aria-label="Distance presets" className="grid grid-cols-5 gap-1.5">
        {presets.map((km) => {
          const selected = distance === km;
          return (
            <button
              key={km}
              type="button"
              onClick={() => onChange(km)}
              aria-pressed={selected}
              aria-label={`${km} kilometres`}
              className={`h-9 rounded-lg border text-xs font-medium transition-all ${
                selected
                  ? 'bg-lime-400/10 border-lime-400/40 text-lime-300'
                  : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200'
              }`}
            >
              {presetLabel(km, mode)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
