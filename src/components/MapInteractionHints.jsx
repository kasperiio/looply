import { X } from 'lucide-react';

export default function MapInteractionHints({ onDismiss }) {
  return (
    <div className="absolute top-4 right-4 z-[900] max-w-xs">
      <div className="bg-gray-950/85 backdrop-blur-sm border border-gray-800 rounded-xl p-3 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-gray-200">Map tips</p>
          <button
            type="button"
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-200 transition-colors"
            aria-label="Close map tips"
          >
            <X size={14} />
          </button>
        </div>
        <ul className="mt-2 space-y-1.5 text-xs text-gray-400 leading-snug">
          <li>Waypoints can be moved by dragging and dropping.</li>
          <li>Waypoints can be added by double-clicking on the route.</li>
          <li>Remember to set your preferences before generating a route.</li>
        </ul>
      </div>
    </div>
  );
}
