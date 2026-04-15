import { Duration } from '../models/duration';

export type Wait4MeRequest = {
    requestId: string;
    passengerId: string;
    incomingJourneyRef: string;
    outgoingJourneyRef: string;
    transferStopRef: number;
    scheduledDepartureTime: Date;
    requestedDelay: Duration;
    status: string;
}