import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Wait4MeButton } from '../wait4me-button/wait4me-button';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { W4MPassengerService } from '../../../shared/services/w4m-service-passenger';
import { PassengerTransferLeg, PassengerTrip } from '../../../shared/types/PassengerTripTypes'
import { Duration } from '../../../shared/models/duration';

@Component({
  selector: 'app-connection-details',
  imports: [CommonModule, Wait4MeButton],
  templateUrl: './connection-details.html',
  styleUrls: ['../../../app.css','../passenger-interface.css', './connection-details.css'],
})
export class ConnectionDetails {

  trip: PassengerTrip | null = null;

  public tripService = inject(OJPTrip);
  public w4mService = inject(W4MPassengerService);

  constructor(private router: Router) {
    const navigation = this.router.currentNavigation();
    this.trip = navigation?.extras.state?.['selectedTrip'] ?? null;
    if (this.trip?.criticalTransfer) {
      console.log(this.trip?.criticalTransfer);
      this.w4mService.enable_if_eligible(this.trip);
    }
  }


  popup_walking_route(transferLeg: PassengerTransferLeg): void {
    // TODO display walking route
    console.log("see detailed walking route for transfer");
    return;
  }

  backToPassenger(): void {
    this.router.navigate(['/passenger']);
  }
}
