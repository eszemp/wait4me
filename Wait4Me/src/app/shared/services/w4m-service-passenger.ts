import { Injectable, signal, WritableSignal } from '@angular/core';
import { Subscription, timer, lastValueFrom, switchMap, tap } from 'rxjs';
import { CriticalTransfer } from '../types/PassengerTripTypes';
import { PassengerTrip } from '../types/PassengerTripTypes';
import { v4 as uuidv4 } from 'uuid';
import { HttpClient } from '@angular/common/http';
import { GetStatusResponse, PostResponse} from '../types/Wait4MeRequest';
import { BACKEND_URL } from '../config/backend';
import { W4M_REQUEST_CONFIG } from '../config/w4m-request-config';

@Injectable({ providedIn: 'root' })
export class W4MPassengerService {
  /**
   * Client-side passenger service for creating and tracking wait4me requests.
   *
   * Manages UI-visible status signals, holds the currently selected trip and
   * critical transfer, and communicates with the backend to create and poll
   * request status changes. The service also handles lifecycle actions like
   * enabling/disabling the request UI and cancelling active requests.
   */
  readonly status: WritableSignal<
    'inactive' | 'enabled' | 'pending' | 'accepted' | 'declined' | 'expired'
  > = signal('inactive');
  readonly acceptedStatusBarDismissed = signal(false);
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
  requested_delay: Number | null;

  private pollingSubscription: Subscription | null = null;

  constructor(private http: HttpClient) {
    this.trip = null;
    this.transfer = null;
    this.passenger_id = uuidv4();
    this.request_id = null;
    this.requested_delay = null;
  }

  /**
   * Enable the service for a specific trip if the contained critical transfer
   * meets configured eligibility constraints (timing and requested delay).
   * When enabled the service retains the `trip` and `transfer` for later
   * request creation.
   *
   * @param trip the selected `PassengerTrip` to evaluate
   */
  enable_if_eligible(trip: PassengerTrip) {
    if (this.status() !== 'inactive' && this.status() !== 'enabled') {
      return;
    }
    const transfer = trip.criticalTransfer;
    if (!transfer) {
      this.status.set('inactive');
      return;
    }

    const minutesUntilDeparture =
      (transfer.scheduledOutgoingDeparture.getTime() - Date.now()) / 60000;
    const delay_too_big =
      transfer.requestedDelay.totalMinutes > W4M_REQUEST_CONFIG.maxAllowedDelayMinutes;
    const request_too_early =
      minutesUntilDeparture > W4M_REQUEST_CONFIG.maxMinutesBeforeDepartureToRequest;
    const request_too_late =
      minutesUntilDeparture < W4M_REQUEST_CONFIG.minMinutesBeforeDepartureToRequest;

    if (delay_too_big || request_too_early || request_too_late) {
      this.status.set('inactive');
      return;
    }

    if (W4M_REQUEST_CONFIG.allowOnlyBusRequests && !this.isBusTrip(trip)) {
      this.status.set('inactive');
      return;
    }

    // if eligible, change service State and save criticalTransfer to Service
    this.status.set('enabled');
    this.trip = trip;
    this.transfer = transfer;
    return;
  }

  disable_if_not_active() {
    /**
     * Reset the service to an inactive state when there is no active request
     * or when an accepted request has been dismissed by the user. Does not
     * interrupt requests that are currently `pending`.
     */
    if (this.status() === 'pending') {
      return;
    }
    if (this.status() === 'accepted' && !this.acceptedStatusBarDismissed()) {
      return;
    }
    // else if status is inactive / enabled / declined / expired / accepted and dismissed,
    // then reset to inactive so that a new request can be sent
    this.clean_up();
  }

  dismissAcceptedStatusBar() {
    /** Mark the accepted status bar as dismissed so the UI can be reset. */
    this.acceptedStatusBarDismissed.set(true);
  }

  clean_up() {
    /** Reset all service state and stop any polling. */
    this.status.set('inactive');
    this.acceptedStatusBarDismissed.set(false);
    this.stopStatusPolling();
    this.request_id = null;
    this.requested_delay = null;
    this.trip = null;
    this.transfer = null;
  }

  isBusTrip(trip: PassengerTrip | null | undefined): boolean {
    if (!trip) {
      return false;
    }

    if (trip.criticalTransferId === null || trip.criticalTransferId === undefined) {
      return false;
    }

    const waitingLegId = trip.criticalTransferId + 1;
    const waitingLeg = trip.legs.find(
      (leg): leg is PassengerTrip['legs'][number] & { kind: 'timed' } =>
        leg.kind === 'timed' && leg.id === waitingLegId,
    );
    if (!waitingLeg) {
      return false;
    }

    const busModes = new Set(['bus', 'coach', 'trolleyBus']);
    const rawWaitingLeg = trip.rawTrip.leg?.find(
      (leg) => Number(leg.id) === waitingLegId,
    )?.timedLeg;
    const ptMode = rawWaitingLeg?.service?.mode?.ptMode;
    console.log('[Wait4Me] bus eligibility check', {
      tripId: trip.id,
      criticalTransferId: trip.criticalTransferId,
      waitingLegId,
      ptMode,
      isBus: typeof ptMode === 'string' && busModes.has(ptMode),
    });
    return typeof ptMode === 'string' && busModes.has(ptMode);
  }

  async click_on_button() {
    /**
     * Handler invoked when the passenger UI button is clicked. Behavior
     * depends on the current `status` signal (inactive, enabled, pending,
     * accepted, declined, expired).
     */
    console.log('Initial status: ', this.status());
    switch (this.status()) {
      case 'inactive':
        console.log(
          'Button is not enabled. Select a connection with a eligible critical transfer first. A transfer is eligible for a request if...',
        );
        break;
      case 'enabled':
        await this.trigger_new_request();
        console.log('Sent request with ID: ', this.request_id, 'New status: ', this.status());
        break;
      case 'pending':
        console.log('There is a pending request. Open info dialogue with cancel option.');
        break;
      case 'accepted':
        console.log('There is an accepted request. Open info dialogue with cancel option.');
        break;
      case 'declined':
        console.log('Request denied. Re-route to find an alternative connection.');
        break;
      case 'expired':
        console.log('Request expired. Re-route to find an alternative connection.');
        break;
      default:
        //nothing happens
        return;
    }
  }

  async trigger_new_request() {
    /**
     * Create a new wait4me request on the backend using the currently stored
     * `transfer` and `passenger_id`. If creation succeeds the service enters
     * the `pending` state and begins polling for status updates.
     */
    const request = {
      passenger_id: this.passenger_id,
      incoming_journey_ref: this.transfer?.incomingJourneyRef,
      outgoing_journey_ref: this.transfer?.outgoingJourneyRef,
      transfer_stop_ref: this.transfer?.transferStopRef,
      scheduled_departure_time: this.transfer?.scheduledOutgoingDeparture.toISOString(),
      requested_delay: this.transfer?.requestedDelay.totalMinutes,
    };
    const response = await lastValueFrom(
      this.http.post<PostResponse>(`${BACKEND_URL}/create-request`, request),
    );

    console.log('Script Output:', response);

    if (response.api_status === 'created') {
      this.request_id = response.request_id ?? null;
      this.requested_delay = this.transfer?.requestedDelay.totalMinutes ?? null;
      this.acceptedStatusBarDismissed.set(false);
      this.status.set('pending');
      this.startStatusPolling();
    }
    return;
  }

  async cancel_request() {
    /**
     * Cancel an active backend request. If the backend confirms the change
     * the service stops polling and resets to `inactive`.
     */
    console.log('cancelling request', this.request_id, 'current status', this.status());
    if (!this.request_id || (this.status() !== 'pending' && this.status() !== 'accepted')) {
      return;
    }

    try {
      const response = await lastValueFrom(
        this.http.post<PostResponse>(`${BACKEND_URL}/update-request/${this.request_id}`, {
          status: 'cancelled',
        }),
      );

      if (response.api_status === 'changed') {
        this.stopStatusPolling();
        this.request_id = null;
        this.requested_delay = null;
        this.acceptedStatusBarDismissed.set(false);
        this.status.set('inactive');
        return;
      }

      console.error('Cancel request failed, backend did not confirm change:', response);
    } catch (error) {
      console.error('Cancel request failed:', error);
    }
  }

  private stopStatusPolling() {
    /** Stop the periodic polling subscription, if active. */
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private startStatusPolling() {
    /**
     * Begin periodic polling of the backend for the current request status.
     * Polls every 5s and updates the `status` signal accordingly.
     */
    console.log('polling results from db for request', this.request_id);
    if (!this.request_id || this.pollingSubscription) {
      return;
    }

    this.pollingSubscription = timer(0, 5000)
      .pipe(
        switchMap(() =>
          this.http.get<GetStatusResponse>(`${BACKEND_URL}/get-status/${this.request_id}`),
        ),
        tap((response) => {
          if (response.request_status === 'pending') {
            this.status.set('pending');
            console.log('request still pending');

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
            this.acceptedStatusBarDismissed.set(false);
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
        }),
      )
      .subscribe({
        error: (error) => {
          console.error('Request status polling failed:', error);
        },
      });
  }
}
