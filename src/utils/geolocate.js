/**
 * Browser geolocation, in one place.
 *
 * Both the map's locate control and the empty-state prompt ask for a position,
 * and both need the same failure handling — a denied permission has to say so
 * rather than silently doing nothing. Keeping it here stops the two flows from
 * drifting apart on wording or on which errors they bother to report.
 *
 * Never call this on page load. A permission dialog with no explanation in
 * front of it is how a browser earns a permanent "deny" for the origin, after
 * which the feature cannot be offered again.
 */

const DEFAULT_TIMEOUT_MS = 10000;

const PERMISSION_DENIED = 1;

const DENIED_MESSAGE =
  'Location permission denied. Search for a place, or click the map to set a start point.';
const FAILED_MESSAGE =
  'Could not get your location. Search for a place, or click the map to set a start point.';
const UNSUPPORTED_MESSAGE = 'This browser cannot share your location.';

/**
 * @returns {Promise<{lat: number, lng: number}>} rejects with an Error whose
 *   message is already fit to show the user.
 */
export function requestPosition({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(UNSUPPORTED_MESSAGE));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      (err) => reject(new Error(err?.code === PERMISSION_DENIED ? DENIED_MESSAGE : FAILED_MESSAGE)),
      { timeout: timeoutMs }
    );
  });
}
