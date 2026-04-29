import { Component, effect, inject, DestroyRef } from '@angular/core';
import { timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Wait4MeButton } from '../wait4me-button/wait4me-button';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { W4MPassengerService } from '../../../shared/services/w4m-service-passenger';
import { PassengerTimedLeg, PassengerTransferLeg, PassengerTrip } from '../../../shared/types/PassengerTripTypes'
import { Duration } from '../../../shared/models/duration';

@Component({
  selector: 'app-connection-details',
  imports: [CommonModule, Wait4MeButton],
  templateUrl: './connection-details.html',
  styleUrls: ['../../../app.css','../passenger-interface.css', './connection-details.css'],
})
export class ConnectionDetails {
  public tripService = inject(OJPTrip);
  public w4mService = inject(W4MPassengerService);
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

      if (trip.criticalTransfer) {
        console.log(trip.criticalTransfer);
        this.w4mService.enable_if_eligible(trip);
      }

      const timedLegs = trip.legs.filter((leg): leg is PassengerTimedLeg => leg.kind === 'timed');
      const firstTimedLeg = timedLegs[0];
      const lastTimedLeg = timedLegs[timedLegs.length - 1];

      if (firstTimedLeg) {
        this.tripService.originName.set(firstTimedLeg.boardStopName);
        this.tripService.originId.set(null);
      }
      if (lastTimedLeg) {
        this.tripService.destinationName.set(lastTimedLeg.alightStopName);
        this.tripService.destinationId.set(null);
      }
    });

    timer(60000, 60000)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(() => {
      if (this.tripService.selectedConnectionTrip()) {
        console.log("update trip with realtime traffic info");
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
      state: { selectedTrip: this.trip, transferLegId: transferLeg.id }
    });
  }

  backToPassenger(): void {
    this.router.navigate(['/passenger']);
    this.w4mService.disable_if_not_active();
  }
}
