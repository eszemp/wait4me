import { Duration } from '../models/duration';

export type DepartureLine = {
  line: string;
  course: string | null;
  journeyRef: string;
  direction: string;
  destinationStopPointRef?: string | null;
  departureTimetable: Date;
  departureEstimated: Date;
  departureDelay: Duration;
  arrivalTimetable: Date;
  arrivalEstimated: Date;
  arrivalDelay: Duration;
  departurePlatformOrStop: string | null;
  stops: DepartureStop[];
};

export type DepartureStop = {
  id: string;
  name: string;
  timeTimetable: Date;
  timeEstimated: Date;
  delay: Duration;
};

export type StopLookupResult = {
  stopPlaceRef: string;
  stopPlaceName: string;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
};

export type NearbyStopLookupResult = StopLookupResult & {
  latitude: number;
  longitude: number;
  distanceMeters: number;
};

export type DriverStopRow = {
  id: string;
  name: string;
  timeTimetable: Date;
  timeEstimated: Date;
  delay: Duration;
  label: string;
};