import { Duration } from '../models/duration';
import type { TripSchema } from 'ojp-shared-types';

export type PassengerTimedLeg = {
  kind: 'timed';
  id: number;
  duration: Duration;
  boardTimeTimetable: Date;
  boardTimeEstimated: Date;
  boardDelay: Duration;
  alightTimeTimetable: Date;
  alightTimeEstimated: Date;
  alightDelay: Duration;
  boardStopName: string;
  alightStopName: string;
  boardPlatform: string | null;
  destinationText: string;
  journeyRef: string;
  lineName: string;
};

export type PassengerTransferLeg = {
  kind: 'transfer';
  id: number;
  duration: Duration;
};

export type PassengerLeg = PassengerTimedLeg | PassengerTransferLeg;

export type PassengerTrip = {
  id: string;
  startTime: Date;
  scheduledStart: Date;
  startDelay: Duration;
  endTime: Date;
  scheduledEnd: Date;
  endDelay: Duration;
  duration: Duration;
  transfers: number;
  departurePlatform: string | null;
  legs: PassengerLeg[];
  criticalTransferId: number | null;
  criticalTransfer: CriticalTransfer | null;
  rawTrip: TripSchema;
};

export type CriticalTransfer = {
  incomingJourneyRef: string;
  outgoingJourneyRef: string;
  transferStopRef: number;
  scheduledOutgoingDeparture: Date;
  requestedDelay: Duration;
};
