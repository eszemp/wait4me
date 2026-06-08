/**
 * Configuration constants for the Wait4Me passenger request logic.
 *
 * These values control eligibility checks (timing and maximum delay), whether
 * geofencing is enforced, and the default buffer width used when checking if
 * a user is close enough to a connection track.
 */
export const W4M_REQUEST_CONFIG = {
  // Maximum delay a passenger can request from a driver.
  maxAllowedDelayMinutes: 60,

  // A request is only allowed if at least this many minutes remain before departure. 
  // Use negative values to allow requesting after departure, which can be useful for testing and in case of unexpected delays.
  minMinutesBeforeDepartureToRequest: 110,

  // A request is considered "too early" if it is made when more than this many
  // minutes remain until departure. This prevents requesting excessively far
  // in advance (e.g. hours before the trip).
  maxMinutesBeforeDepartureToRequest: 120,

  // Toggle geofencing checks for request eligibility.
  geofencingEnabled: true,

  // Buffer width (meters) used for geofence checks around the connection track.
  bufferWidthMeters: 25000,
} as const;
