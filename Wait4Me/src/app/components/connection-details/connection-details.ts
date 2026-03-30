import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DurationPipe } from '../../shared/pipes/duration.pipes';
import { OJPTrip } from '../../services/ojp-trip';
import { PassengerTransferLeg, PassengerTrip } from '../../shared/types/PassengerTrip'

@Component({
  selector: 'app-connection-details',
  imports: [CommonModule, DurationPipe],
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
}
