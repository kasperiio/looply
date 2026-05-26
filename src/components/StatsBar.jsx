import { Route, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 flex-1 min-w-0">
      <Icon
        size={14}
        className={accent ? 'text-lime-400 shrink-0' : 'text-gray-500 shrink-0'}
      />
      <div className="min-w-0">
        <p className="text-gray-500 text-xs leading-none mb-0.5">{label}</p>
        <p className={`font-semibold text-sm leading-none truncate ${accent ? 'text-lime-400' : 'text-gray-100'}`}>
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

export default function StatsBar({
  distance, ascent,
  routeIdx, routeCount, onPrev, onNext,
}) {
  const hasData = distance > 0;

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
        <RouteNav
          routeIdx={routeIdx}
          routeCount={routeCount}
          onPrev={onPrev}
          onNext={onNext}
        />
      </div>
    </div>
  );
}
