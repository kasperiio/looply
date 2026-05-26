export default function MapEmptyHint({ hasStartPoint }) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
      <div className="bg-gray-950/75 backdrop-blur-sm border border-gray-800 rounded-2xl px-5 py-3 text-center shadow-xl">
        <p className="text-gray-300 text-sm font-medium leading-snug">
          {hasStartPoint ? 'Hit Generate Route to create a loop' : 'Click the map to set your start point'}
        </p>
        <p className="text-gray-600 text-xs mt-1">
          {hasStartPoint ? 'Or adjust settings in the sidebar first' : 'Or search for an address in the sidebar'}
        </p>
      </div>
    </div>
  );
}
