import { Crosshair, Loader2 } from 'lucide-react';

export default function MapEmptyHint({ hasStartPoint, onUseMyLocation, locating }) {
  return (
    // The wrapper stays click-through so it never blocks the map underneath;
    // only the card itself takes pointer events, and only when it has a button.
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[500] pointer-events-none px-4">
      <div
        className={`bg-gray-950/75 backdrop-blur-sm border border-gray-800 rounded-2xl px-5 py-3 text-center shadow-xl ${
          hasStartPoint ? '' : 'pointer-events-auto'
        }`}
      >
        <p className="text-gray-300 text-sm font-medium leading-snug">
          {hasStartPoint ? 'Hit Generate Route to create a loop' : 'Where do you want to start?'}
        </p>

        {hasStartPoint ? (
          <p className="text-gray-600 text-xs mt-1">Or adjust settings in the sidebar first</p>
        ) : (
          <>
            {/* The permission prompt is only ever raised by this button, so the
                browser dialog always arrives with a reason in front of it. */}
            <button
              type="button"
              onClick={onUseMyLocation}
              disabled={locating}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-lime-400 hover:bg-lime-300 disabled:opacity-60
                         disabled:cursor-not-allowed text-gray-950 text-xs font-semibold
                         transition-colors"
            >
              {locating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Crosshair size={12} />
              )}
              {locating ? 'Locating…' : 'Use my location'}
            </button>
            <p className="text-gray-600 text-xs mt-2">
              Or click the map, or search an address
            </p>
          </>
        )}
      </div>
    </div>
  );
}
