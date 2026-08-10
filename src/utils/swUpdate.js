/**
 * Service worker registration and forced refresh onto new builds.
 *
 * The worker calls skipWaiting() on install, so a new release activates as
 * soon as the browser notices /sw.js changed and fires controllerchange —
 * at which point the page reloads itself onto the new build. No prompt: a
 * user running stale code is the thing we are trying to prevent.
 *
 * A navigation triggers the browser's update check, but an installed PWA can
 * stay open for days without ever navigating, so also check on an interval
 * and whenever the app returns to the foreground.
 */

const UPDATE_CHECK_MS = 15 * 60 * 1000;

/** @returns {() => void} cleanup */
export function initServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return () => {};

  // Only a page that already had a controller can be running stale code. The
  // first worker claiming an as-yet-uncontrolled page is an install, not an
  // update, and reloading for it would be a pointless flash on first visit.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  let registration = null;
  let interval = null;

  const onControllerChange = () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  };

  const checkForUpdate = () => {
    if (document.visibilityState === 'visible') registration?.update().catch(() => {});
  };

  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      registration = reg;
      interval = setInterval(checkForUpdate, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', checkForUpdate);
    })
    .catch(() => {
      // Registration failed — the app still works, it just won't self-update.
    });

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    document.removeEventListener('visibilitychange', checkForUpdate);
    if (interval) clearInterval(interval);
  };
}
