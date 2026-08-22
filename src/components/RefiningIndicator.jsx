import { Loader2 } from 'lucide-react';

/**
 * Shown once a first usable loop is on the map but better alternatives are
 * still arriving. Deliberately not the full LoadingOverlay: the map already
 * has something worth looking at, so this has to stay out of the way and must
 * never swallow clicks.
 */
export default function RefiningIndicator({ count }) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none
                    flex items-center gap-2 px-3 py-1.5 rounded-full
                    bg-gray-950/85 border border-gray-800 backdrop-blur-sm shadow-xl">
      <Loader2 size={13} className="text-lime-400 animate-spin shrink-0" />
      <span className="text-gray-300 text-xs font-medium whitespace-nowrap">
        {count > 0 ? `${count} route${count === 1 ? '' : 's'} — finding more…` : 'Finding more routes…'}
      </span>
    </div>
  );
}
