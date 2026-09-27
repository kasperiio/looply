/** Re-export BRouter client API for existing imports */
export {
  SERVER_BUSY_MESSAGE,
  fetchRoute,
  isAbortError,
  isIslandError,
  isRateLimited,
  warmupProfile,
} from './brouter/client.js';
