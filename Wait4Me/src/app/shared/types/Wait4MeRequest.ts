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
};

export interface PostResponse {
  api_status: string;
  request_id?: string;
}

export interface GetStatusResponse {
  api_status: string;
  request_status: string;
}

export interface GetRequestResponse {
  api_status: string;
  incoming_requests: Array<JSON>;
  cancelled_requests: Array<JSON>;
}
