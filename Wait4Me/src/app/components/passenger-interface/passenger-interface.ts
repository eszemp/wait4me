import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouteFormComponent } from '../route-form/route-form.component';
import { OJPTrip } from '../../services/ojp-trip';
import { DurationPipe } from '../../shared/pipes/duration.pipes';

@Component({
  selector: 'app-passenger-interface',
  imports: [CommonModule, ReactiveFormsModule, RouteFormComponent, DurationPipe],
  templateUrl: './passenger-interface.html',
  styleUrls: ['../../app.css','./passenger-interface.css'],
})

export class PassengerInterface {

  public tripService = inject(OJPTrip);
  private router = inject(Router);

  constructor() {
    const navigation = this.router.currentNavigation();
    const state = navigation?.extras.state as { clearStorage: boolean };
    if (state?.clearStorage) {
      sessionStorage.clear();
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

  selectConnection(trip: any): void {
    console.log("clicked on a connection");
    this.router.navigate(['/passenger/connection-details'], { 
      state: { selectedTrip: trip } 
    });
    return;
  }
}

