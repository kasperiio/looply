import { useState, useEffect, useCallback, useMemo } from 'react';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import ElevationChart from './components/ElevationChart';
import StatsBar from './components/StatsBar';
import LoadingOverlay from './components/LoadingOverlay';
import MapStatusToast from './components/MapStatusToast';
import SearchAreaBanner from './components/SearchAreaBanner';
import MapEmptyHint from './components/MapEmptyHint';
import MapInteractionHints from './components/MapInteractionHints';
import { haversineKm } from './utils/circularRoute';
import { reverseGeocode } from './utils/nominatim';
import { downloadGpx } from './utils/gpxExport';
import { readUrlParams, writeUrlParams } from './utils/urlState';
import { insertWaypointByRouteOrder } from './utils/routeEditing';
import { generateRoutes } from './services/routeGenerator';
import { recalcRoute } from './services/routeRecalculator';
import { ChevronRight } from 'lucide-react';

export default function App() {
  const init = readUrlParams();

  const [startPoint, setStartPoint] = useState(
    init.lat != null && init.lng != null ? { lat: init.lat, lng: init.lng } : null
  );
  const [areaPoint, setAreaPoint] = useState(
    init.areaLat != null && init.areaLng != null ? { lat: init.areaLat, lng: init.areaLng } : null
  );
  const [mapDragCenter, setMapDragCenter] = useState(null);
  const [startLabel, setStartLabel] = useState('');
  const [distance, setDistance] = useState(init.distance);
  const [mode, setMode] = useState(init.mode);
  const [surfacePref, setSurfacePref] = useState(init.surfacePref);
  const [wellLit, setWellLit] = useState(init.wellLit);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMapHints, setShowMapHints] = useState(true);
  const [elevationBias, setElevationBias] = useState(init.elevationBias);

  const [routes, setRoutes] = useState([]);
  const [routeIdx, setRouteIdx] = useState(0);
  const currentRoute = routes[routeIdx] ?? null;

  const [hoverPoint, setHoverPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const routingParams = useMemo(
    () => ({ mode, surfacePref, wellLit, elevationBias }),
    [mode, surfacePref, wellLit, elevationBias]
  );

  useEffect(() => {
    if (init.lat == null || init.lng == null) return;
    reverseGeocode(init.lat, init.lng)
      .then(setStartLabel)
      .catch(() => setStartLabel(`${init.lat.toFixed(5)}, ${init.lng.toFixed(5)}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!init.lat && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const lat = coords.latitude;
          const lng = coords.longitude;
          setStartPoint({ lat, lng });
          reverseGeocode(lat, lng)
            .then(setStartLabel)
            .catch(() => setStartLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`));
        },
        () => {}
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    writeUrlParams({ startPoint, areaPoint, distance, mode, surfacePref, wellLit, elevationBias });
  }, [startPoint, areaPoint, distance, mode, surfacePref, wellLit, elevationBias]);

  const handleMapClick = useCallback(async (lat, lng) => {
    if (currentRoute) return;
    setStartPoint({ lat, lng });
    setAreaPoint(null);
    setMapDragCenter(null);
    try {
      const label = await reverseGeocode(lat, lng);
      setStartLabel(label);
    } catch {
      setStartLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }, [currentRoute]);

  const handleStartSearch = useCallback((lat, lng, label) => {
    setStartPoint({ lat, lng });
    setAreaPoint(null);
    setMapDragCenter(null);
    setStartLabel(label);
  }, []);

  const handleMapDrag = useCallback((lat, lng) => {
    setMapDragCenter({ lat, lng });
  }, []);

  const handleClearArea = useCallback(() => setAreaPoint(null), []);

  const handleClearRoutes = useCallback(() => {
    setRoutes([]);
    setRouteIdx(0);
    setHoverPoint(null);
    setAreaPoint(null);
    setMapDragCenter(null);
  }, []);

  const recalcRouteWithWaypoints = useCallback(async (waypointsToUse) => {
    setLoading(true);
    setError(null);
    const result = await recalcRoute({ startPoint, waypointsToUse, ...routingParams });
    if (result.error) {
      setError(result.error);
    } else {
      setRoutes([result.route]);
      setRouteIdx(0);
    }
    setLoading(false);
  }, [startPoint, routingParams]);

  const handleWaypointDrag = useCallback((idx, lat, lng) => {
    if (!currentRoute || !Number.isInteger(idx)) return;
    const nextWaypoints = [...(currentRoute.waypoints ?? [])];
    if (!nextWaypoints[idx]) return;
    nextWaypoints[idx] = { lat, lng };
    recalcRouteWithWaypoints(nextWaypoints);
  }, [currentRoute, recalcRouteWithWaypoints]);

  const handleRouteDoubleClick = useCallback((lat, lng) => {
    if (!currentRoute) return;
    recalcRouteWithWaypoints(insertWaypointByRouteOrder(currentRoute, { lat, lng }));
  }, [currentRoute, recalcRouteWithWaypoints]);

  const handleGenerate = useCallback(async (preferredArea = areaPoint, options = {}) => {
    setLoading(true);
    setError(null);
    const result = await generateRoutes({
      startPoint,
      distance,
      preferredArea,
      prioritizeArea: options?.prioritizeArea === true,
      ...routingParams,
    });
    if (result.error) {
      setError(result.error);
    } else {
      setRoutes(result.routes);
      setRouteIdx(0);
    }
    setLoading(false);
  }, [startPoint, areaPoint, distance, routingParams]);

  const handleSearchInArea = useCallback(() => {
    if (!mapDragCenter || !startPoint || loading) return;
    setAreaPoint(mapDragCenter);
    setMapDragCenter(null);
    handleGenerate(mapDragCenter, { prioritizeArea: true });
  }, [mapDragCenter, startPoint, loading, handleGenerate]);

  const handlePrevRoute = useCallback(
    () => setRouteIdx((i) => (i - 1 + routes.length) % routes.length),
    [routes.length]
  );

  const handleNextRoute = useCallback(
    () => setRouteIdx((i) => (i + 1) % routes.length),
    [routes.length]
  );

  const handleExportGpx = useCallback(() => {
    if (!currentRoute) return;
    downloadGpx(currentRoute.points, `looply-${distance}km`);
  }, [currentRoute, distance]);

  const showSearchAreaButton =
    !!startPoint &&
    !!mapDragCenter &&
    (() => {
      const anchor = areaPoint ?? startPoint;
      return haversineKm([anchor.lat, anchor.lng], [mapDragCenter.lat, mapDragCenter.lng]) > 0.5;
    })();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[9998] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
        fixed md:static top-0 left-0 h-full z-[9999] md:z-auto
        w-72 shrink-0 flex flex-col bg-gray-950 border-r border-gray-800
        transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}
      >
        <Sidebar
          startLabel={startLabel}
          distance={distance}
          mode={mode}
          surfacePref={surfacePref}
          wellLit={wellLit}
          elevationBias={elevationBias}
          onStartSearch={handleStartSearch}
          onDistanceChange={setDistance}
          onModeChange={setMode}
          onSurfaceChange={setSurfacePref}
          onLitToggle={setWellLit}
          onElevationChange={setElevationBias}
          onGenerate={handleGenerate}
          onClearRoutes={handleClearRoutes}
          onExportGpx={handleExportGpx}
          loading={loading}
          hasRoute={!!currentRoute}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        <div className="flex-1 relative">
          {!sidebarOpen && (
            <button
              type="button"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-[9999] md:hidden
                         bg-gray-900 border-y border-r border-gray-700
                         rounded-r-xl py-5 px-1 text-gray-400 hover:text-lime-400
                         shadow-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open settings"
            >
              <ChevronRight size={15} />
            </button>
          )}

          <MapView
            startPoint={startPoint}
            routePoints={currentRoute?.points ?? []}
            segments={currentRoute?.segments ?? []}
            waypoints={currentRoute?.waypoints ?? []}
            hoverPoint={hoverPoint}
            onMapClick={handleMapClick}
            onMapDrag={handleMapDrag}
            onWaypointDrag={handleWaypointDrag}
            onRouteDoubleClick={handleRouteDoubleClick}
          />

          <SearchAreaBanner
            showSearchButton={showSearchAreaButton}
            areaPoint={areaPoint}
            onSearchInArea={handleSearchInArea}
            onClearArea={handleClearArea}
          />
          {showMapHints && <MapInteractionHints onDismiss={() => setShowMapHints(false)} />}

          {loading && <LoadingOverlay />}
          {!currentRoute && !loading && <MapEmptyHint hasStartPoint={!!startPoint} />}
          <MapStatusToast message={error} variant="error" onDismiss={() => setError(null)} />
        </div>

        {currentRoute && (
          <div className="h-44 bg-gray-950/95 border-t border-gray-800 flex flex-col px-4 py-3 gap-2 backdrop-blur-sm">
            <StatsBar
              distance={currentRoute.distance}
              ascent={currentRoute.ascent}
              routeIdx={routeIdx}
              routeCount={routes.length}
              onPrev={handlePrevRoute}
              onNext={handleNextRoute}
            />
            <div className="flex-1">
              <ElevationChart
                points={currentRoute.points}
                segments={currentRoute.segments ?? []}
                onHoverPoint={setHoverPoint}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
