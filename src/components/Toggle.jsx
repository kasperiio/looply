export default function Toggle({ label, icon: Icon, checked, onChange, description }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
        checked
          ? 'bg-lime-400/10 border-lime-400/30 text-lime-300'
          : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
      }`}
    >
      <Icon size={14} className={checked ? 'text-lime-400' : 'text-gray-500'} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-none">{label}</p>
        {description && <p className="text-[10px] text-gray-600 mt-0.5">{description}</p>}
      </div>
      <div className={`w-8 h-4 rounded-full transition-colors shrink-0 ${checked ? 'bg-lime-400' : 'bg-gray-700'}`}>
        <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${checked ? 'translate-x-4.5 ml-0.5' : 'ml-0.5'}`} />
      </div>
    </button>
  );
}
