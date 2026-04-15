import { Injectable } from '@angular/core';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
import { CriticalTransfer } from '../shared/types/PassengerTripTypes';
import { PassengerTrip } from '../shared/types/PassengerTripTypes';
import { v4 as uuidv4 } from 'uuid';
import { HttpClient } from '@angular/common/http';

interface CreateRequestResponse {
  status: string;
  request_id?: string;
}


@Injectable({ providedIn: 'root' })
export class W4MPassengerService {

  status: string;
  // possible values:
  // 'inactive':  no critical transfer selected where a request could be sent
  // 'enabled':   this.transfer is not null, but no request has been sent yet or the request has been cancelled
  // 'pending':   ...
  // 'accepted':  ...
  // 'declined':  ...
  trip: PassengerTrip | null;
  transfer: CriticalTransfer | null;
  passenger_id: string;
  request_id: string | null;


  private currentTrip = new BehaviorSubject<any>(null);
  currentTrip$ = this.currentTrip.asObservable();
  

  constructor(private http: HttpClient) {
    this.status = 'inactive';
    this.trip = null;
    this.transfer = null;
    this.passenger_id = uuidv4();
    this.request_id = null;
  }

  updateTrip(trip: any) {
    this.currentTrip.next(trip);
    return;
  }

  enable_if_eligible(transfer: CriticalTransfer) {
    // TODO: determine max allowed requested delay and difference to current time
    const delay_too_big = (transfer.requestedDelay.totalMinutes>=60);
    const request_too_early = false;// TODO: (transfer.scheduledOutgoingDeparture);
    if (delay_too_big || request_too_early) {
      return;
    }
    // TODO: also check DB to see if there is already a denied request for this transferstop and outgoing service for the same or a smaller delay.
    // if eligible, change service State and save criticalTransfer to Service
    this.status = 'enabled';
    this.transfer = transfer;
    return;
  }

  async click_on_button() {
    console.log("Initial status: ", this.status)
    switch (this.status) {
    case 'inactive':
      console.log("Button is not enabled. Select a connection with a eligible critical transfer first. A transfer is eligible for a request if...");
      break;
    case 'enabled':
      await this.trigger_new_request();
      console.log("Sent request with ID: ", this.request_id, "New status: ", this.status);
      break;
    case 'pending':
      console.log("There is a pending request. Open info dialogue with cancel option.");
      break;
    case 'accepted':
      console.log("There is an accepted request. Open info dialogue with cancel option.");
      break;
    case 'declined':
      console.log("Request denied. Open info dialogue with cancel option.");
      break;
    default:
      //nothing happens
      return;
    }
  }

  async trigger_new_request() {
    const request = {
      passenger_id: this.passenger_id,
      incoming_journey_ref: this.transfer?.incomingJourneyRef,
      outgoing_journey_ref: this.transfer?.outgoingJourneyRef,
      transfer_stop_ref: this.transfer?.transferStopRef,
      scheduled_departure_time: this.transfer?.scheduledOutgoingDeparture.toISOString(),
      requested_delay: this.transfer?.requestedDelay.totalMinutes,
    }
    const response = await lastValueFrom(
      this.http.post<CreateRequestResponse>('http://127.0.0.1:5000/create-request', request)
    );

    console.log('Script Output:', response);

    if (response.status === "created") {
      this.request_id = response.request_id ?? null;
      this.status = 'pending';
    }
    return;
  }
}
