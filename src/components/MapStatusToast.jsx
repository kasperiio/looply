import { AlertCircle, X } from 'lucide-react';

export default function MapStatusToast({ message, variant = 'error', onDismiss }) {
  if (!message) return null;

  const isSuccess = variant === 'success' || message.startsWith('✓');

  return (
    <div
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm shadow-2xl backdrop-blur-sm max-w-sm ${
        isSuccess
          ? 'bg-lime-400/10 border-lime-400/30 text-lime-300'
          : 'bg-red-500/10 border-red-500/30 text-red-300'
      }`}
    >
      {!isSuccess && <AlertCircle size={14} className="shrink-0" />}
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100" aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  );
}
