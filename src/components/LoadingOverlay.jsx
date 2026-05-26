import { Loader2 } from 'lucide-react';

export default function LoadingOverlay({ message = 'Finding your route…' }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-[500] pointer-events-none">
      <div className="bg-gray-950/80 backdrop-blur-sm border border-gray-800 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl">
        <Loader2 size={18} className="text-lime-400 animate-spin shrink-0" />
        <span className="text-gray-200 text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
