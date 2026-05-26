import { X } from 'lucide-react';

export default function SearchAreaBanner({ showSearchButton, areaPoint, onSearchInArea, onClearArea }) {
  if (showSearchButton) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[650]">
        <button
          type="button"
          onClick={onSearchInArea}
          className="px-4 py-2 rounded-full bg-gray-950/90 backdrop-blur-sm border border-sky-400/30 text-sky-300 text-sm font-medium shadow-2xl hover:border-sky-400/50 hover:text-sky-200 transition-colors"
        >
          Search in this area
        </button>
      </div>
    );
  }

  if (!areaPoint) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[640]">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-950/90 backdrop-blur-sm border border-sky-400/20 text-sky-300 text-xs font-medium shadow-2xl">
        <span>Including selected area</span>
        <button
          type="button"
          onClick={onClearArea}
          className="text-sky-300/80 hover:text-sky-100 transition-colors"
          aria-label="Clear selected area"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
