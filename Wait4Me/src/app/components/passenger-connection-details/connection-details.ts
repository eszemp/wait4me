import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Wait4MeButton } from '../passenger-interface/wait4me-button/wait4me-button';
import { OJPTrip } from '../../services/ojp-trip';
import { PassengerTransferLeg, PassengerTrip } from '../../shared/types/PassengerTripTypes'
import { Duration } from '../../shared/models/duration';

@Component({
  selector: 'app-connection-details',
  imports: [CommonModule, Wait4MeButton],
  templateUrl: './connection-details.html',
  styleUrls: ['../../app.css','../passenger-interface/passenger-interface.css', './connection-details.css'],
})
export class ConnectionDetails {

  trip: PassengerTrip | null = null;

  public tripService = inject(OJPTrip);

  constructor(private router: Router) {
    const navigation = this.router.currentNavigation();
    this.trip = navigation?.extras.state?.['selectedTrip'] ?? null;
  }

  popup_walking_route(transferLeg: PassengerTransferLeg): void {
    console.log("see detailed walking route for transfer");
    return;
  }

  backToPassenger(): void {
    this.router.navigate(['/passenger']);
  }
}
