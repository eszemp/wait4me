export const W4M_REQUEST_CONFIG = {
  // Maximum delay a passenger can request from a driver.
  maxAllowedDelayMinutes: 60,

  // A request is only allowed if at least this many minutes remain before departure.
  minMinutesBeforeDepartureToRequest: 2,

  // A request is considered "too early" if it is made when more than this many
  // minutes remain until departure. This prevents requesting excessively far
  // in advance (e.g. hours before the trip).
  maxMinutesBeforeDepartureToRequest: 45,

  // Toggle geofencing checks for request eligibility.
  geofencingEnabled: false,
} as const;
