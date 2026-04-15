import { Injectable } from '@angular/core';
import { Subscription, timer, lastValueFrom, switchMap, tap } from 'rxjs';
import { Wait4MeRequest, RequestResponse } from '../shared/types/Wait4MeRequest';
import { HttpClient } from '@angular/common/http';
import { Duration } from '../shared/models/duration';


interface GetRequestResponse {
  message?: string;
  data?: JSON;
}

const BACKEND_URL = 'http://127.0.0.1:5000';


@Injectable({ providedIn: 'root' })
export class W4MDriverService {

  // for querying all request at a stop
  journey_ref: string = '';
  stop_ref: Number = 0;

  // for editing a stop
  edit_mode: Boolean = false;
  request_id: string = ' ';

  constructor(private http: HttpClient) {}

  public accept_request() : void {
    // TODO
  }
  public decline_request() : void {
    // TODO
  }

  public set_params_query(journey: string, stop: Number) {
    this.journey_ref = journey;
    console.log("Jouney_Ref:", this.journey_ref);
    this.stop_ref = stop;
    console.log("Stop Ref: ", this.stop_ref);
  }

  async query_all_requests(): Promise<Wait4MeRequest[]> {
    try {
      const response = await lastValueFrom(
        this.http.get<any>(`${BACKEND_URL}/driver/get-requests?transfer_stop_ref=${this.stop_ref}&outgoing_service=${this.journey_ref}`)
      );

      console.log('API Response:', response);

      // Check for the "No incoming connections" message inside the object
      if (response?.message === "No incoming connections") {
        return [];
      }

      const rawArray = Array.isArray(response) ? response : response?.data;

      console.log('Raw Array:', rawArray);

      if (!Array.isArray(rawArray)) {
        console.warn('Response format not recognized as an array:', response);
        return [];
      }

      const W4M_Array = rawArray.map((data: any) => {
        return {
          requestId: data.request_id,
          passengerId: data.passenger_id,
          incomingJourneyRef: data.incoming_journey_ref,
          outgoingJourneyRef: data.outgoing_journey_ref,
          transferStopRef: data.transfer_stop_ref,
          scheduledDepartureTime: new Date(data.scheduled_departure_time),
          requestedDelay: Duration.initFromTotalMinutes(data.requested_delay_min),
          status: data.status
        } satisfies Wait4MeRequest;
      });

      console.log(W4M_Array);
      return W4M_Array;

    } catch (error) {
      console.error('DB Query of all requests failed:', error);
      return [];
    }
  }


}
