import { Duration } from '../models/duration';

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
  destinationText: string;
  alightStopName: string;
  boardPlatform: string | null;
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
  criticalTransfer: number | null; // id of critical PassengerTransferLeg
};