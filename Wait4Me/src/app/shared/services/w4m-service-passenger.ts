import { Injectable, signal, WritableSignal } from '@angular/core';
import { BehaviorSubject, Subscription, timer, lastValueFrom, switchMap, tap } from 'rxjs';
import { CriticalTransfer } from '../types/PassengerTripTypes';
import { PassengerTrip } from '../types/PassengerTripTypes';
import { v4 as uuidv4 } from 'uuid';
import { HttpClient } from '@angular/common/http';
import { GetStatusResponse, PostResponse, BACKEND_URL } from '../types/Wait4MeRequest';





@Injectable({ providedIn: 'root' })
export class W4MPassengerService {

  readonly status: WritableSignal<'inactive' | 'enabled' | 'pending' | 'accepted' | 'declined' | 'expired'> = signal('inactive');
  // possible values:
  // 'inactive':  no critical transfer selected where a request could be sent
  // 'enabled':   this.transfer is not null, but no request has been sent yet or the request has been cancelled
  // 'pending':   ...
  // 'accepted':  ...
  // 'declined':  ...
  // 'expired': ...

  trip: PassengerTrip | null;
  transfer: CriticalTransfer | null;
  passenger_id: string;
  request_id: string | null;

  private pollingSubscription: Subscription | null = null;

  constructor(private http: HttpClient) {
    this.trip = null;
    this.transfer = null;
    this.passenger_id = uuidv4();
    this.request_id = null;
  }

  enable_if_eligible(trip: PassengerTrip) {
    if (this.status()!=='inactive') {
      return;
    }
    // TODO: determine max allowed requested delay and difference to current time
    const delay_too_big = (trip.criticalTransfer!.requestedDelay.totalMinutes>=60);
    const request_too_early = false;// TODO: (transfer.scheduledOutgoingDeparture);
    const request_too_late = false;
    if (delay_too_big || request_too_early || request_too_late) {
      return;
    }
    // TODO: geofencing
    // TODO: also check DB to see if there is already a denied request for this transferstop and outgoing service for the same or a smaller delay.
    // TODO: aslo check if its in the past
    // if eligible, change service State and save criticalTransfer to Service
    this.status.set('enabled');
    this.trip = trip;
    this.transfer = trip.criticalTransfer!;
    return;
  }

  disable_if_not_active() {
    // TODO: what to do with accepted request?
    if (this.status()==='pending') {
      return;
    }
    // else if status is inactive / enabled / declined / expired, reset to inactive
    this.status.set('inactive');
  }

  async click_on_button() {
    console.log("Initial status: ", this.status())
    switch (this.status()) {
    case 'inactive':
      console.log("Button is not enabled. Select a connection with a eligible critical transfer first. A transfer is eligible for a request if...");
      break;
    case 'enabled':
      await this.trigger_new_request();
      console.log("Sent request with ID: ", this.request_id, "New status: ", this.status());
      break;
    case 'pending':
      console.log("There is a pending request. Open info dialogue with cancel option.");
      break;
    case 'accepted':
      console.log("There is an accepted request. Open info dialogue with cancel option.");
      break;
    case 'declined':
      console.log("Request denied. Re-route to find an alternative connection.");
      break;
    case 'expired':
      console.log("Request expired. Re-route to find an alternative connection.");
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
      this.http.post<PostResponse>(`${BACKEND_URL}/create-request`, request)
    );

    console.log('Script Output:', response);

    if (response.api_status === "created") {
      this.request_id = response.request_id ?? null;
      this.status.set('pending');
      this.startStatusPolling();
    }
    return;
  }

  async cancel_request() {
    console.log('cancelling request', this.request_id, 'current status', this.status());
    if (!this.request_id || (this.status() !== 'pending' && this.status() !== 'accepted')) {
      return;
    }

    try {
      const response = await lastValueFrom(
        this.http.post<PostResponse>(
          `${BACKEND_URL}/update-request/${this.request_id}`,
          { status: 'cancelled' }
        )
      );

      if (response.api_status === 'changed') {
        this.stopStatusPolling();
        this.request_id = null;
        this.status.set('enabled');
        return;
      }

      console.error('Cancel request failed, backend did not confirm change:', response);
    } catch (error) {
      console.error('Cancel request failed:', error);
    }
  }

  private stopStatusPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private startStatusPolling() {
    console.log("polling results from db for request", this.request_id);
    if (!this.request_id || this.pollingSubscription) {
      return;
    }

    this.pollingSubscription = timer(0, 5000)
      .pipe(
        switchMap(() => this.http.get<GetStatusResponse>(`${BACKEND_URL}/get-status/${this.request_id}`)),
        tap(response => {

          if (response.request_status=== 'pending') {
            this.status.set('pending');
            console.log('request still pending')
  
            const curDate = new Date();
            if (this.transfer!.scheduledOutgoingDeparture < curDate) {
              console.log('request technically expired, kept pending during development');
              // TODO: post status change to DB
              // this.status.set('expired');
              // return;
            }  

            return;
          }

          if (response.request_status === 'accepted') {
            this.status.set('accepted');
            console.log('request status changed from pending to ', this.status());
            this.stopStatusPolling();
          }

          if (response.request_status === 'declined') {
            this.status.set('declined');
            console.log('request status changed from pending to ', this.status());
            this.stopStatusPolling();
          }

          if (response.request_status === 'expired') {
            this.status.set('expired');
            console.log('request status changed from pending to ', this.status());
            this.stopStatusPolling();
          }
        })
      )
      .subscribe({
        error: error => {
          console.error('Request status polling failed:', error);
        }
      });
  }
}
