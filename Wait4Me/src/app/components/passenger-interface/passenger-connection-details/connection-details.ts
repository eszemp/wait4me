import { Component, effect, inject, DestroyRef } from '@angular/core';
import { timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Wait4MeButton } from '../wait4me-button/wait4me-button';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { W4MPassengerService } from '../../../shared/services/w4m-service-passenger';
import { GeofenceService } from '../../../shared/services/geofence.service';
import {
  PassengerTimedLeg,
  PassengerTransferLeg,
  PassengerTrip,
} from '../../../shared/types/PassengerTripTypes';
import { Duration } from '../../../shared/models/duration';

@Component({
  selector: 'app-connection-details',
  imports: [CommonModule, Wait4MeButton],
  templateUrl: './connection-details.html',
  styleUrls: ['../../../app.css', '../passenger-interface.css', './connection-details.css'],
})
/**
 * Component that displays detailed information for a selected passenger
 * connection. The component reads the selected trip from `OJPTrip` service,
 * keeps origin/destination names in sync, periodically refines the trip with
 * realtime data and triggers geofence checks to enable the Wait4Me request
 * UI via `W4MPassengerService`.
 */
export class ConnectionDetails {
  public tripService = inject(OJPTrip);
  public w4mService = inject(W4MPassengerService);
  public geofenceService = inject(GeofenceService);
  private readonly destroyRef = inject(DestroyRef);

  constructor(private router: Router) {
    const navigation = this.router.currentNavigation();
    const selectedTrip = navigation?.extras.state?.['selectedTrip'] ?? null;
    if (selectedTrip) {
      this.tripService.selectedConnectionTrip.set(selectedTrip);
    }

    effect(() => {
      const trip = this.trip;
      if (!trip) {
        return;
      }

      const timedLegs = trip.legs.filter((leg): leg is PassengerTimedLeg => leg.kind === 'timed');
      const firstTimedLeg = timedLegs[0];
      const lastTimedLeg = timedLegs[timedLegs.length - 1];

      if (firstTimedLeg) {
        this.tripService.originName.set(firstTimedLeg.boardStopName);
      }
      if (lastTimedLeg) {
        this.tripService.destinationName.set(lastTimedLeg.alightStopName);
      }
    });

    timer(0, 10000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const trip = this.trip;
        if (!trip?.criticalTransfer) {
          return;
        }

        void this.geofenceService.isUserWithinGeofenceForTrip(trip).then((within) => {
          if (within) {
            this.w4mService.enable_if_eligible(trip);
          }
        });
      });

    timer(60000, 60000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.tripService.selectedConnectionTrip()) {
          console.log('update trip with realtime traffic info');
          this.tripService.refineTrip();
        }
      });
  }

  get trip(): PassengerTrip | null {
    return this.tripService.selectedConnectionTrip();
  }

  /**
   * Opens the walking-route view for the clicked transfer leg.
   */
  popup_walking_route(transferLeg: PassengerTransferLeg): void {
    this.router.navigate(['/passenger/walking-route'], {
      state: { selectedTrip: this.trip, transferLegId: transferLeg.id },
    });
  }

  backToPassenger(): void {
    this.router.navigate(['/passenger']);
    this.w4mService.disable_if_not_active();
  }

  getRequestState(): string {
    const state = this.w4mService.status();
    if (this.w4mService.trip) {
      if (this.trip == this.w4mService.trip) {
        return state;
      }
    }
    return 'inactive';
  }
}
