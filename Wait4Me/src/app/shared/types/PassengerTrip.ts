export type PassengerTimedLeg = {
  kind: 'timed';
  id: string;
  duration: string;
  boardTimeTimetable: string;
  boardTimeEstimated: string;
  boardDelay: number;
  alightTimeTimetable: string;
  alightTimeEstimated: string;
  alightDelay: number;
  boardStopName: string;
  destinationText: string;
  alightStopName: string;
  boardPlatform: string | null;
};

export type PassengerTransferLeg = {
  kind: 'transfer';
  id: string;
  duration: string;
};

export type PassengerLeg = PassengerTimedLeg | PassengerTransferLeg;

export type PassengerTrip = {
  id: string;
  startTime: string;
  endTime: string;
  duration: string;
  transfers: number;
  departurePlatform: string | null;
  legs: PassengerLeg[];
};