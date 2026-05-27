import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { W4MPassengerService } from '../../../shared/services/w4m-service-passenger';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { Router } from '@angular/router';
import { PassengerTimedLeg } from '../../../shared/types/PassengerTripTypes';
import { Duration } from '../../../shared/models/duration';
import { W4M_REQUEST_CONFIG } from '../../../shared/config/w4m-request-config';
import { GeofenceService } from '../../../shared/services/geofence.service';

@Component({
  selector: 'w4m-button',
  imports: [CommonModule],
  templateUrl: './wait4me-button.html',
  styleUrls: ['./wait4me-button.css', '../../../app.css'],
})
export class Wait4MeButton {
  public w4mService = inject(W4MPassengerService);
  public tripService = inject(OJPTrip);
  public geofenceService = inject(GeofenceService);
  private router = inject(Router);
  readonly requestConfig = W4M_REQUEST_CONFIG;
  showRequestConfirmation = false;
  showRequestDetails = false;
  showRequestUnavailable = false;
  isSubmittingRequest = false;
  showAlternativeLoading = false;
  requestConfirmationTopPx = 120;

  on_wait4me_button_click() {
    if (this.geofenceService.locationAccessWarning()) {
      this.update_request_confirmation_position();
      return;
    }

    if (this.w4mService.status() === 'enabled') {
      this.update_request_confirmation_position();
      this.showRequestConfirmation = true;
      return;
    }
    if (!this.is_inside_trip_details()) {
      return;
    }
    this.update_request_confirmation_position();
    this.showRequestUnavailable = true;
  }

  get waiting_connection_leg(): PassengerTimedLeg | null {
    const trip = this.w4mService.trip;
    if (!trip || trip.criticalTransferId === null || trip.criticalTransferId === undefined) {
      return null;
    }
    const waiting_leg_id = trip.criticalTransferId + 1;
    return (
      trip.legs.find(
        (leg): leg is PassengerTimedLeg => leg.kind === 'timed' && leg.id === waiting_leg_id,
      ) ?? null
    );
  }

  get request_details_origin_name(): string {
    return this.requested_trip_first_leg?.boardStopName ?? '';
  }

  get request_details_destination_name(): string {
    return this.requested_trip_last_leg?.alightStopName ?? '';
  }

  private get requested_trip_first_leg(): PassengerTimedLeg | null {
    const trip = this.w4mService.trip;
    if (!trip) {
      return null;
    }
    return trip.legs.find((leg): leg is PassengerTimedLeg => leg.kind === 'timed') ?? null;
  }

  private get requested_trip_last_leg(): PassengerTimedLeg | null {
    const trip = this.w4mService.trip;
    if (!trip) {
      return null;
    }
    const timed_legs = trip.legs.filter((leg): leg is PassengerTimedLeg => leg.kind === 'timed');
    return timed_legs[timed_legs.length - 1] ?? null;
  }

  @HostListener('window:resize')
  on_window_resize() {
    if (!this.showRequestConfirmation) {
      return;
    }
    this.update_request_confirmation_position();
  }

  private update_request_confirmation_position() {
    const trip_overview = document.querySelector('.trip-overview') as HTMLElement | null;
    if (!trip_overview) {
      this.requestConfirmationTopPx = 120;
      return;
    }
    const rect = trip_overview.getBoundingClientRect();
    this.requestConfirmationTopPx = Math.round(rect.top);
  }

  private is_inside_trip_details(): boolean {
    return this.router.url === '/passenger/connection-details';
  }

  close_request_confirmation() {
    this.showRequestConfirmation = false;
  }

  close_request_unavailable() {
    this.showRequestUnavailable = false;
  }

  close_location_unavailable() {
    this.geofenceService.clearLocationAccessWarning();
  }

  open_request_details() {
    this.update_request_confirmation_position();
    this.showRequestDetails = true;
  }

  close_request_details() {
    this.showRequestDetails = false;
  }

  close_accepted_status_bar() {
    this.w4mService.dismissAcceptedStatusBar();
  }

  get request_details_status_text(): string {
    switch (this.w4mService.status()) {
      case 'accepted':
        return 'Accepted.';
      case 'declined':
        return 'Transfer not possible.';
      case 'expired':
        return 'Request expired. Outgoing service has departed.';
      case 'pending':
        return 'Request Pending...';
      default:
        return 'Request Pending...';
    }
  }

  go_to_connection() {
    const requestedTrip = this.w4mService.trip;
    if (!requestedTrip) {
      return;
    }
    this.tripService.selectedConnectionTrip.set(requestedTrip);
    this.showRequestDetails = false;
    if (this.router.url !== '/passenger/connection-details') {
      this.router.navigate(['/passenger/connection-details'], {
        state: { selectedTrip: requestedTrip },
      });
    }
  }

  get request_unavailable_description(): string[] {
    const timeWindow = `${this.requestConfig.minMinutesBeforeDepartureToRequest} to ${this.requestConfig.maxMinutesBeforeDepartureToRequest} minutes before departure`;
    const geofenceMessage = this.requestConfig.geofencingEnabled
      ? `Geofencing is enabled, so you also need to be inside the route buffer of the trip route.`
      : 'Geofencing is currently disabled, so only the time window matters.';

    return [
      'You can send a Wait4Me request only when the selected trip is inside the configured request window and the connection is broken.',
      `The current request window is ${timeWindow}.`,
      geofenceMessage,
    ];
  }

  async confirm_and_send_request() {
    if (this.isSubmittingRequest) {
      return;
    }
    this.isSubmittingRequest = true;
    try {
      await this.w4mService.trigger_new_request();
      console.log(
        'Sent request with ID: ',
        this.w4mService.request_id,
        'New status: ',
        this.w4mService.status(),
      );
    } finally {
      this.isSubmittingRequest = false;
      this.showRequestConfirmation = false;
    }
  }

  cancel_request() {
    console.log('user wants to cancel');
    this.w4mService.cancel_request();
  }

  search_alternative_route() {
    // prepare data for routing from stop with broken transfer
    const failed_transfer_leg_id = this.w4mService.trip!.criticalTransferId!;
    const timedLegs = this.w4mService.trip!.legs.filter(
      (leg): leg is PassengerTimedLeg => leg.kind === 'timed',
    );
    const next_leg = timedLegs.find((leg) => leg.id === failed_transfer_leg_id + 1)!;
    const last_leg = timedLegs[timedLegs.length - 1]!;

    const rawDuration = this.w4mService.trip!.criticalTransfer?.requestedDelay;
    const requestedDelay = Duration.initFromTotalSeconds(rawDuration!.totalSeconds);

    // show a 3s loading overlay then perform routing/navigation
    this.showAlternativeLoading = true;
    setTimeout(() => {
      this.tripService.originName.set(next_leg.boardStopName);
      this.tripService.originId.set(null);
      this.tripService.destinationName.set(last_leg.alightStopName);
      this.tripService.destinationId.set(null);

      const new_departure = requestedDelay.addToDate(
        this.w4mService.trip!.criticalTransfer!.scheduledOutgoingDeparture,
      );
      if (new_departure) {
        const day = new_departure.toISOString().split('T')[0];
        const time = new_departure.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        });
        this.tripService.departureDay.set(day); // YYYY-MM-DD
        this.tripService.departureTimeOfDay.set(time); // HH:MM
      }
      this.w4mService.disable_if_not_active();
      this.showAlternativeLoading = false;
      this.router.navigate(['/passenger']);
    }, 3000);
  }
}
