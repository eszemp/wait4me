import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { W4MPassengerService } from '../../../shared/services/w4m-service-passenger';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { Router } from '@angular/router';
import { PassengerTimedLeg, PassengerTrip } from '../../../shared/types/PassengerTripTypes';
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
  // Geofence check state used to show which condition fails in the popup
  geofenceCheckInProgress = signal(false);
  geofenceInside = signal<boolean | null>(null);
  // Cached transfer used to render the unavailable message reliably
  currentTransfer = signal<PassengerTrip['criticalTransfer'] | null>(null);

  readonly requestUnavailableHeader =
    'Sending a Wait4Me request is not possible for the following reason:';

  readonly request_unavailable_description = computed(() => {
    const transfer =
      this.currentTransfer() ?? this.tripService.selectedConnectionTrip()?.criticalTransfer ?? null;

    if (!transfer) {
      return [
        {
          kind: 'error' as const,
          text: 'No critical transfer is available for the selected trip.',
        },
      ];
    }

    const delayTooBig =
      transfer.requestedDelay.totalMinutes > this.requestConfig.maxAllowedDelayMinutes;
    if (delayTooBig) {
      return [
        {
          kind: 'error' as const,
          text: `Requested delay exceeds allowed maximum (${this.requestConfig.maxAllowedDelayMinutes} min). Requested: ${Math.round(
            transfer.requestedDelay.totalMinutes,
          )} min.`,
        },
      ];
    }

    const minutesUntilDeparture =
      (transfer.scheduledOutgoingDeparture.getTime() - Date.now()) / 60000;
    const tooEarly = minutesUntilDeparture > this.requestConfig.maxMinutesBeforeDepartureToRequest;
    const tooLate = minutesUntilDeparture < this.requestConfig.minMinutesBeforeDepartureToRequest;
    if (tooEarly) {
      return [
        {
          kind: 'error' as const,
          text: `Too early to request, maximum ${this.requestConfig.maxMinutesBeforeDepartureToRequest} min before departure allowed. Current: ${Math.round(minutesUntilDeparture)} min until departure.`,
        },
      ];
    }
    if (tooLate) {
      return [
        {
          kind: 'error' as const,
          text: `Too late to request, minimum ${this.requestConfig.minMinutesBeforeDepartureToRequest} min before departure needed. Current: ${Math.round(minutesUntilDeparture)} min until departure.`,
        },
      ];
    }

    if (!this.requestConfig.geofencingEnabled) {
      return [{ kind: 'ok' as const, text: 'Geofencing disabled — time window and delay are OK.' }];
    }

    const accessWarning = this.geofenceService.locationAccessWarning();
    if (accessWarning) {
      return [
        {
          kind: 'error' as const,
          text: 'Geofencing: location access not granted. ' + accessWarning,
        },
      ];
    }

    if (this.geofenceCheckInProgress()) {
      return [
        { kind: 'pending' as const, text: 'Checking your location to determine eligibility...' },
      ];
    }

    if (this.geofenceInside() === null) {
      return [
        { kind: 'pending' as const, text: 'Checking your location to determine eligibility...' },
      ];
    }

    if (!this.geofenceInside()) {
      return [
        {
          kind: 'error' as const,
          text: 'Geofencing: You are not on the way to the transfer station.',
        },
      ];
    }

    return [
      {
        kind: 'ok' as const,
        text: 'All eligibility conditions are met. You should be able to send a request.',
      },
    ];
  });

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
    // cache current transfer immediately so the popup has stable data
    this.currentTransfer.set(this.tripService.selectedConnectionTrip()?.criticalTransfer ?? null);
    // start an async evaluation of geofence state (result used by the popup)
    // do not mark checking here — the evaluator will only set checking when
    // geofence verification is actually required (prevents sticky 'checking')
    this.geofenceInside.set(null);
    this.geofenceCheckInProgress.set(false);
    void this.evaluate_unavailable_reasons();
    this.showRequestUnavailable = true;
  }

  private async evaluate_unavailable_reasons() {
    const trip = this.tripService.selectedConnectionTrip();
    this.geofenceInside.set(null);
    // Only perform geofence check when all other eligibility checks pass.
    if (!trip || !trip.criticalTransfer) {
      this.geofenceCheckInProgress.set(false);
      return;
    }

    const transfer = trip.criticalTransfer;
    const delayTooBig =
      transfer.requestedDelay.totalMinutes > this.requestConfig.maxAllowedDelayMinutes;
    const minutesUntilDeparture =
      (transfer.scheduledOutgoingDeparture.getTime() - Date.now()) / 60000;
    const tooEarly = minutesUntilDeparture > this.requestConfig.maxMinutesBeforeDepartureToRequest;
    const tooLate = minutesUntilDeparture < this.requestConfig.minMinutesBeforeDepartureToRequest;

    if (delayTooBig || tooEarly || tooLate) {
      // other conditions already fail — no need to geofence-check
      this.geofenceCheckInProgress.set(false);
      this.geofenceInside.set(null);
      return;
    }

    if (!this.requestConfig.geofencingEnabled) {
      this.geofenceInside.set(true);
      this.geofenceCheckInProgress.set(false);
      return;
    }

    // if location access warning is present we can't perform the check
    if (this.geofenceService.locationAccessWarning()) {
      this.geofenceInside.set(false);
      this.geofenceCheckInProgress.set(false);
      return;
    }

    // perform geofence check but guard with a short timeout so the UI doesn't
    // remain in a perpetual 'checking' state
    this.geofenceCheckInProgress.set(true);
    try {
      const geofencePromise = this.geofenceService.isUserWithinGeofenceForTrip(trip);
      const timeout = new Promise<boolean>((res) => setTimeout(() => res(false), 5000));
      const inside = await Promise.race([geofencePromise, timeout]);
      this.geofenceInside.set(Boolean(inside));
    } catch (e) {
      this.geofenceInside.set(false);
    } finally {
      this.geofenceCheckInProgress.set(false);
    }
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
    this.currentTransfer.set(null);
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
