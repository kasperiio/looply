import { Route, TrendingUp, ChevronLeft, ChevronRight, Download, Trash2, Layers } from 'lucide-react';

function StatCard({ icon: Icon, label, value, accent, className = '' }) {
  return (
    // The value is the whole point of the card, so it never shrinks below its
    // own width: the icon is what gives way first. Between the md breakpoint
    // (where the sidebar becomes pinned) and lg there is very little room, and
    // the icon returning only at lg is what keeps "10.14 km" from becoming
    // "10…".
    <div className={`flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-2 sm:px-3 py-2 flex-1 min-w-0 ${className}`}>
      <Icon
        size={14}
        className={`hidden sm:max-md:block lg:block shrink-0 ${accent ? 'text-lime-400' : 'text-gray-500'}`}
      />
      <div className="min-w-0">
        <p className="text-gray-500 text-xs leading-none mb-0.5 truncate">{label}</p>
        <p className={`font-semibold text-sm leading-none whitespace-nowrap ${accent ? 'text-lime-400' : 'text-gray-100'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * Route switcher card — only rendered when there are multiple alternatives.
 * Sits in the same flex row as the stat cards.
 */
function RouteNav({ routeIdx, routeCount, onPrev, onNext }) {
  if (routeCount <= 1) return null;
  return (
    <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-2 py-2 flex-1 min-w-0">
      <button
        onClick={onPrev}
        className="text-gray-400 hover:text-lime-400 transition-colors p-0.5"
        aria-label="Previous route"
      >
        <ChevronLeft size={14} />
      </button>
      <div className="text-center">
        <p className="text-gray-500 text-xs leading-none mb-0.5">Route</p>
        <p className="font-semibold text-sm text-gray-100 leading-none">
          {routeIdx + 1}&thinsp;/&thinsp;{routeCount}
        </p>
      </div>
      <button
        onClick={onNext}
        className="text-gray-400 hover:text-lime-400 transition-colors p-0.5"
        aria-label="Next route"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function surfaceSummary(surface) {
  if (!surface) return null;
  const paved = Math.round((surface.paved ?? 0) * 100);
  const unpaved = Math.round((surface.unpaved ?? 0) * 100);
  if (paved === 0 && unpaved === 0) return null;
  return paved >= unpaved ? `${paved}% paved` : `${unpaved}% unpaved`;
}

export default function StatsBar({
  distance, ascent, surface,
  routeIdx, routeCount, onPrev, onNext,
  onExportGpx, onClear,
}) {
  const hasData = distance > 0;
  const surfaceText = surfaceSummary(surface);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <StatCard
          icon={Route}
          label="Distance"
          value={hasData ? `${distance.toFixed(2)} km` : '—'}
          accent={hasData}
        />
        <StatCard
          icon={TrendingUp}
          label="Ascent"
          value={hasData ? `${Math.round(ascent)} m` : '—'}
        />
        {/* Distance and ascent are what people act on; surface is context, so
            it steps aside in the narrow band above md where the pinned sidebar
            leaves the bar too little room for three stats. */}
        {surfaceText && (
          <StatCard
            icon={Layers}
            label="Surface"
            value={surfaceText}
            className="hidden sm:max-md:flex lg:flex"
          />
        )}
        <RouteNav
          routeIdx={routeIdx}
          routeCount={routeCount}
          onPrev={onPrev}
          onNext={onNext}
        />
        <div className="flex items-stretch gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onExportGpx}
            title="Download GPX of this route"
            aria-label="Download GPX of this route"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-gray-700 bg-gray-900 text-gray-300 hover:border-lime-400/50 hover:text-lime-300 text-xs font-medium transition-all"
          >
            <Download size={13} />
            <span className="hidden md:inline">GPX</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            title="Clear route"
            aria-label="Clear route"
            className="flex items-center px-2.5 sm:px-3 rounded-lg border border-gray-800 bg-gray-900 text-gray-500 hover:border-red-400/50 hover:text-red-300 text-xs font-medium transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
