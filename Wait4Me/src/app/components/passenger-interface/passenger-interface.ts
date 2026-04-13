import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouteFormComponent } from './route-form/route-form.component';
import { Wait4MeButton } from './wait4me-button/wait4me-button';
import { OJPTrip} from '../../services/ojp-trip';
import { PassengerTrip } from '../../shared/types/PassengerTripTypes';
import { Duration } from '../../shared/models/duration';

@Component({
  selector: 'app-passenger-interface',
  imports: [CommonModule, ReactiveFormsModule, RouteFormComponent, Wait4MeButton],
  templateUrl: './passenger-interface.html',
  styleUrls: ['../../app.css','./passenger-interface.css'],
})

export class PassengerInterface {

  public tripService = inject(OJPTrip);
  private router = inject(Router);

  constructor() {
    // clear saved values if component is newly loaded
    const state = history.state;
    if (state && state.clearStorage === true) {
      sessionStorage.clear();
      this.tripService.reset();
      history.replaceState({}, '')
    }

    // fill out form fields with saved values (if they exist)
    if (sessionStorage.getItem("origin_name") && sessionStorage.getItem("destination_name")){
      this.tripForm.patchValue({
        from: sessionStorage.getItem("origin_name") ?? '',
        to: sessionStorage.getItem("destination_name") ?? ''
      });
    }

    // Connect form date and time to trip service signals
    this.tripForm.valueChanges.subscribe(value => {
      this.tripService.departureDay.set(value.date || null);
      this.tripService.departureTimeOfDay.set(value.time || null);
    });

    // Set initial values
    this.tripService.departureDay.set(this.tripForm.value.date || null);
    this.tripService.departureTimeOfDay.set(this.tripForm.value.time || null);

    // fill out form fields with saved values (if they exist)
    if (sessionStorage.getItem("departure_day") && sessionStorage.getItem("departure_time_of_day")){
      this.tripForm.patchValue({
        date: sessionStorage.getItem("departure_day") ?? '',
        time: sessionStorage.getItem("departure_time_of_day") ?? ''
      });
    }
  }

  readonly tripForm = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    date: new FormControl(this.getDefaultDate(), { nonNullable: true }),
    time: new FormControl(this.getDefaultTime(), { nonNullable: true })
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
    console.log("clicked on a connection");
    this.router.navigate(['/passenger/connection-details'], { 
      state: { selectedTrip: trip } 
    });
    return;
  }
}

