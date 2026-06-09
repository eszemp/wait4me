export type ConnectionLineFeature = {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    line: string;
    featureType: 'track';
    stationStops: TimedLegStop[];
  };
};

export type ConnectionStationFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    line: string;
    featureType: 'station';
    stopRef: string;
    stopName: string;
    stopRole: 'board' | 'intermediate' | 'alight';
    arrivalTime: string;
  };
};

export type ConnectionTrackFeature = ConnectionLineFeature | ConnectionStationFeature;

export type WalkingRouteFeature = {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    featureType: 'walking-transfer';
    transferLegId: number;
  };
};

export type TimedLegStop = {
  stopRef: string;
  stopName: string;
  stopRole: 'board' | 'intermediate' | 'alight';
  arrivalTime: string;
};

export type LocationSuggestion = {
  stopPlaceName: string;
  stopPlaceRef: string;
};
