import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import StatsBar from './components/StatsBar';
import LoadingOverlay from './components/LoadingOverlay';
import MapStatusToast from './components/MapStatusToast';
import SearchAreaBanner from './components/SearchAreaBanner';
import MapEmptyHint from './components/MapEmptyHint';
import MapInteractionHints from './components/MapInteractionHints';
import RefiningIndicator from './components/RefiningIndicator';
import { haversineKm } from './utils/circularRoute';
import { reverseGeocode } from './utils/nominatim';
import { downloadGpx } from './utils/gpxExport';
import { readUrlParams, writeUrlParams } from './utils/urlState';
import { warmupProfile } from './utils/brouter';
import { initServiceWorker } from './utils/swUpdate';
import { insertWaypointByRouteOrder } from './utils/routeEditing';
import { requestPosition } from './utils/geolocate.js';
import { clearRoutes as clearStoredRoutes, loadRoutes, routeSetSignature, saveRoutes } from './utils/routeStorage.js';
import { clampDistanceKm } from './constants/distance.js';
import { useEdgeSwipe } from './hooks/useEdgeSwipe.js';
import { generateRoutes } from './services/routeGenerator';
import { recalcRoute } from './services/routeRecalculator';
import { ChevronRight } from 'lucide-react';

// Recharts is the single biggest thing in the bundle and is only needed once a
// route exists — which is never, on a first visit that has not generated yet.
// Splitting it out keeps the initial load to the map and the sidebar.
const ElevationChart = lazy(() => import('./components/ElevationChart'));

// How long the one-time map hints stay up before dismissing themselves.
const MAP_HINTS_VISIBLE_MS = 12000;

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
  const [bikeType, setBikeType] = useState(init.bikeType);
  const [surfacePref, setSurfacePref] = useState(init.surfacePref);
  const [wellLit, setWellLit] = useState(init.wellLit);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMapHints, setShowMapHints] = useState(() => {
    try {
      return localStorage.getItem('looply.hintsDismissed') !== '1';
    } catch {
      return true;
    }
  });
  const [elevationBias, setElevationBias] = useState(init.elevationBias);

  // Restored synchronously on first render: regenerating costs ~27 requests
  // against a rate-limited public service, so a reload must not silently throw
  // the previous result away.
  const [restored] = useState(() =>
    loadRoutes(
      routeSetSignature({
        startPoint: init.lat != null && init.lng != null ? { lat: init.lat, lng: init.lng } : null,
        areaPoint:
          init.areaLat != null && init.areaLng != null
            ? { lat: init.areaLat, lng: init.areaLng }
            : null,
        distance: init.distance,
        mode: init.mode,
        bikeType: init.bikeType,
        surfacePref: init.surfacePref,
        wellLit: init.wellLit,
        elevationBias: init.elevationBias,
      })
    )
  );

  const [routes, setRoutes] = useState(restored?.routes ?? []);
  const [routeIdx, setRouteIdx] = useState(restored?.routeIdx ?? 0);
  const currentRoute = routes[routeIdx] ?? null;

  const [hoverPoint, setHoverPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  // Distinct from `loading`: `loading` means nothing is on the map yet and the
  // blocking overlay is right; `refining` means a usable loop is already shown
  // and better candidates are still landing behind it.
  const [refining, setRefining] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  // Every generation gets a number. Only the newest one is allowed to write
  // state, so a slow run that resolves after a newer one cannot clobber it —
  // and the controller lets a superseded run stop sending requests at all
  // rather than finishing into the void.
  const generationRef = useRef(0);
  const abortRef = useRef(null);
  const routingParams = useMemo(
    () => ({ mode, bikeType, surfacePref, wellLit, elevationBias }),
    [mode, bikeType, surfacePref, wellLit, elevationBias]
  );

  // Upload the routing profile ahead of the first Generate.
  useEffect(() => {
    warmupProfile(mode);
  }, [mode]);

  // Reloads the page onto a new build as soon as one is deployed.
  useEffect(() => initServiceWorker(), []);

  // Don't leave requests running for a page that is going away.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (init.lat == null || init.lng == null) return;
    reverseGeocode(init.lat, init.lng)
      .then(setStartLabel)
      .catch(() => setStartLabel(`${init.lat.toFixed(5)}, ${init.lng.toFixed(5)}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced for the same reason as the URL write below, and additionally
  // because progressive publishing updates `routes` several times per
  // generation — only the settled result is worth serializing.
  useEffect(() => {
    if (loading || refining) return undefined;
    const signature = routeSetSignature({
      startPoint, areaPoint, distance, mode, bikeType, surfacePref, wellLit, elevationBias,
    });
    // Nothing on screen is not the same as the user discarding their work:
    // opening the app at a different distance must not delete the set saved
    // under the old one, or switching back would mean regenerating from
    // scratch. Only the Clear button drops the stored set.
    if (routes.length === 0) return undefined;
    const id = setTimeout(() => saveRoutes(signature, routes, routeIdx), 400);
    return () => clearTimeout(id);
  }, [routes, routeIdx, loading, refining, startPoint, areaPoint, distance, mode, bikeType, surfacePref, wellLit, elevationBias]);

  // Debounced: dragging the distance or terrain slider fires this on every
  // tick, and replaceState is not free. Nothing reads the URL back mid-drag,
  // so it only has to catch up once the user settles.
  useEffect(() => {
    const id = setTimeout(() => {
      writeUrlParams({ startPoint, areaPoint, distance, mode, bikeType, surfacePref, wellLit, elevationBias });
    }, 250);
    return () => clearTimeout(id);
  }, [startPoint, areaPoint, distance, mode, bikeType, surfacePref, wellLit, elevationBias]);

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

  // Only ever reached from the empty state's "Use my location" button. Asking
  // on mount put a bare permission dialog in front of a first-time visitor,
  // which is both a poor introduction and the fastest way to earn a permanent
  // "deny" for the origin — after which the feature cannot be offered again.
  const handleUseMyLocation = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const { lat, lng } = await requestPosition();
      setStartPoint({ lat, lng });
      setAreaPoint(null);
      setMapDragCenter(null);
      // With a start point in hand the next step is picking a distance, so
      // surface the settings drawer (a no-op on desktop, where it is pinned).
      setSidebarOpen(true);
      try {
        setStartLabel(await reverseGeocode(lat, lng));
      } catch {
        setStartLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLocating(false);
    }
  }, []);

  const handleStartSearch = useCallback((lat, lng, label) => {
    setStartPoint({ lat, lng });
    setAreaPoint(null);
    setMapDragCenter(null);
    setStartLabel(label);
  }, []);

  const handleMapDrag = useCallback((lat, lng) => {
    setMapDragCenter({ lat, lng });
  }, []);

  // Running has a lower ceiling than cycling, so a long ride's target has to
  // come back into range when the mode switches.
  const handleModeChange = useCallback((nextMode) => {
    setMode(nextMode);
    setDistance((km) => clampDistanceKm(km, nextMode));
  }, []);

  const handleClearArea = useCallback(() => setAreaPoint(null), []);

  const handleClearRoutes = useCallback(() => {
    // Abandon anything still in flight, and make sure its result cannot land.
    abortRef.current?.abort();
    generationRef.current += 1;
    clearStoredRoutes();
    setLoading(false);
    setRefining(false);
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
      // Edit the current alternative in place — the other candidates and the
      // route pager stay available.
      setRoutes((prev) => prev.map((r, i) => (i === routeIdx ? result.route : r)));
    }
    setLoading(false);
  }, [startPoint, routingParams, routeIdx]);

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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation;

    setLoading(true);
    setRefining(true);
    setError(null);
    setRoutes([]);
    setRouteIdx(0);

    const result = await generateRoutes({
      startPoint,
      distance,
      preferredArea,
      prioritizeArea: options?.prioritizeArea === true,
      ...routingParams,
      signal: controller.signal,
      // Candidates arrive over several seconds; show the best loop found so
      // far rather than a spinner over an empty map.
      onPartial: (partialRoutes) => {
        if (!isCurrent()) return;
        setRoutes(partialRoutes);
        // Something is on the map now — swap the blocking overlay for the
        // unobtrusive indicator.
        setLoading(false);
        setSidebarOpen(false);
      },
    });

    if (!isCurrent() || result.aborted) return;

    if (result.error) {
      setError(result.error);
    } else {
      setRoutes(result.routes);
      setSidebarOpen(false);
    }
    setLoading(false);
    setRefining(false);
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

  const rememberMapHintsSeen = () => {
    try {
      localStorage.setItem('looply.hintsDismissed', '1');
    } catch {
      // private mode etc. — the flag just won't persist
    }
  };

  const handleDismissMapHints = useCallback(() => {
    setShowMapHints(false);
    rememberMapHintsSeen();
  }, []);

  // The hints are a one-time introduction: they persist as "seen" when the
  // user dismisses them, or once they have been on screen long enough to read,
  // whichever comes first. Marking them seen the instant they rendered also
  // stopped them reappearing forever, but it left the dismiss button racing a
  // flag that was already written — a control that did nothing.
  const mapHintsVisible = showMapHints && !!currentRoute;
  useEffect(() => {
    if (!mapHintsVisible) return undefined;
    const id = setTimeout(() => {
      setShowMapHints(false);
      rememberMapHintsSeen();
    }, MAP_HINTS_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [mapHintsVisible]);

  const edgeSwipe = useEdgeSwipe(useCallback(() => setSidebarOpen(true), []));

  const showSearchAreaButton =
    !!startPoint &&
    !!mapDragCenter &&
    (() => {
      const anchor = areaPoint ?? startPoint;
      return haversineKm([anchor.lat, anchor.lng], [mapDragCenter.lat, mapDragCenter.lng]) > 0.5;
    })();

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-950">
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
          bikeType={bikeType}
          surfacePref={surfacePref}
          wellLit={wellLit}
          elevationBias={elevationBias}
          onStartSearch={handleStartSearch}
          onDistanceChange={setDistance}
          onModeChange={handleModeChange}
          onBikeTypeChange={setBikeType}
          onSurfaceChange={setSurfacePref}
          onLitToggle={setWellLit}
          onElevationChange={setElevationBias}
          onGenerate={handleGenerate}
          loading={loading || refining}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        <div className="flex-1 relative">
          {!sidebarOpen && (
            <>
              {/* Catches the open gesture above the map, so Leaflet never sees
                  it as a pan. */}
              <div
                className="absolute inset-y-0 left-0 w-6 z-[9998] md:hidden"
                {...edgeSwipe}
              />

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
            </>
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
            onLocateError={setError}
          />

          <SearchAreaBanner
            showSearchButton={showSearchAreaButton}
            areaPoint={areaPoint}
            onSearchInArea={handleSearchInArea}
            onClearArea={handleClearArea}
          />
          {mapHintsVisible && <MapInteractionHints onDismiss={handleDismissMapHints} />}

          {loading && <LoadingOverlay />}
          {!loading && refining && <RefiningIndicator count={routes.length} />}
          {!currentRoute && !loading && (
            <MapEmptyHint
              hasStartPoint={!!startPoint}
              onUseMyLocation={handleUseMyLocation}
              locating={locating}
            />
          )}
          <MapStatusToast message={error} variant="error" onDismiss={() => setError(null)} />
        </div>

        {currentRoute && (
          <div className="h-44 bg-gray-950/95 border-t border-gray-800 flex flex-col px-4 py-3 gap-2 backdrop-blur-sm">
            <StatsBar
              distance={currentRoute.distance}
              ascent={currentRoute.ascent}
              surface={currentRoute.surface}
              routeIdx={routeIdx}
              routeCount={routes.length}
              onPrev={handlePrevRoute}
              onNext={handleNextRoute}
              onExportGpx={handleExportGpx}
              onClear={handleClearRoutes}
            />
            <div className="flex-1">
              {/* No spinner: the chunk resolves in a frame or two on any
                  connection that just fetched a route, and a flash of
                  placeholder is worse than an empty strip. */}
              <Suspense fallback={null}>
                <ElevationChart
                  points={currentRoute.points}
                  segments={currentRoute.segments ?? []}
                  onHoverPoint={setHoverPoint}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
