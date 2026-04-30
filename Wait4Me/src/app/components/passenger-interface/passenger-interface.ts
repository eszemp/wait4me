import { Component, inject, DestroyRef } from '@angular/core';
import { timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouteFormComponent } from './route-form/route-form.component';
import { Wait4MeButton } from './wait4me-button/wait4me-button';
import { OJPTrip } from '../../shared/services/ojp-trip';
import { PassengerTrip } from '../../shared/types/PassengerTripTypes';

@Component({
  selector: 'app-passenger-interface',
  imports: [CommonModule, ReactiveFormsModule, RouteFormComponent, Wait4MeButton],
  templateUrl: './passenger-interface.html',
  styleUrls: ['../../app.css', './passenger-interface.css'],
})
export class PassengerInterface {
  public tripService = inject(OJPTrip);
  private readonly destroyRef = inject(DestroyRef);
  private router = inject(Router);

  constructor() {
    // clear saved values if component is newly loaded
    const state = history.state;
    if (state && state.clearStorage === true) {
      this.tripService.reset();
      history.replaceState({}, '');
    }

    // fill out form fields with existing values
    if (this.tripService.originName() && this.tripService.destinationName()) {
      this.tripForm.patchValue({
        from: this.tripService.originName()!,
        to: this.tripService.destinationName()!,
      });
    }

    // set initial values if they don't exist already
    if (!this.tripService.departureDay() && !this.tripService.departureTimeOfDay()) {
      this.tripService.departureDay.set(this.tripForm.value.date || null);
      this.tripService.departureTimeOfDay.set(this.tripForm.value.time || null);
    }

    // fill out form fields with existing values
    if (this.tripService.departureDay() && this.tripService.departureTimeOfDay()) {
      this.tripForm.patchValue({
        date: this.tripService.departureDay()!,
        time: this.tripService.departureTimeOfDay()!,
      });
    }

    timer(60000, 60000)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(() => {
      this.refreshTrips();
    });
  }

  private refreshTrips() : void {
    // Only refresh if start / stop is defined for routing
      if (this.tripService.originId() && this.tripService.destinationId()) {
        this.tripService.isLoadingTrips.set(true);
        this.tripService.getTripInformation(
          this.tripService.originId()!,
          this.tripService.destinationId()!,
          this.tripService.departureDay() || '',
          this.tripService.departureTimeOfDay() || '',
        ).subscribe({
          next: (results) => {
            Promise.all(results)
              .then((resolvedResults) => {
                this.tripService.tripResults.set(resolvedResults);
                this.tripService.isLoadingTrips.set(false);
              })
              .catch(() => {
                this.tripService.tripResults.set([]);
                this.tripService.isLoadingTrips.set(false);
              });
          },
          error: () => {
            this.tripService.tripResults.set([]);
            this.tripService.isLoadingTrips.set(false);
          },
        });
        console.log("real-time traffic data updated.")
      } 
    return;
  }

  readonly tripForm = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    date: new FormControl(this.getDefaultDate(), { nonNullable: true }),
    time: new FormControl(this.getDefaultTime(), { nonNullable: true }),
  });

  private getDefaultDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getDefaultTime(): string {
    const now = new Date();
    const hours = `${now.getHours()}`.padStart(2, '0');
    const minutes = `${now.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  selectConnection(trip: PassengerTrip): void {
    console.log('clicked on a connection');
    this.router.navigate(['/passenger/connection-details'], {
      state: { selectedTrip: trip },
    });
    // TODO: W4M if no active request, make sure w4m button is disabled when a new connection is selected
    return;
  }
}
