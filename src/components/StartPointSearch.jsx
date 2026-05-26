import { MapPin, Search, Loader2 } from 'lucide-react';
import { usePlaceSearch } from '../hooks/usePlaceSearch.js';

export default function StartPointSearch({ startLabel, onStartSearch }) {
  const {
    query,
    results,
    searching,
    showResults,
    handleQueryChange,
    setQuery,
    clearResults,
  } = usePlaceSearch(startLabel);

  const handleSelect = (r) => {
    setQuery(r.display_name.split(',').slice(0, 2).join(','));
    clearResults();
    onStartSearch(parseFloat(r.lat), parseFloat(r.lon), r.display_name);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
        <MapPin size={11} className="text-lime-400" /> Start Point
      </label>
      <div className="relative">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search address or click map…"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-lime-400/50 transition-colors"
          />
          {searching && (
            <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />
          )}
        </div>
        {showResults && results.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl max-h-48 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-lime-300 transition-colors border-b border-gray-800 last:border-0"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-600">Or click anywhere on the map</p>
    </div>
  );
}
