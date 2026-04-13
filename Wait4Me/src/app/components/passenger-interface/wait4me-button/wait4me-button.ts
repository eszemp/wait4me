import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OJPTrip } from '../../../services/ojp-trip';
import { PassengerTrip } from '../../../shared/types/PassengerTripTypes';
import { Duration } from '../../../shared/models/duration';

@Component({
    selector: 'w4m-button',
    imports: [CommonModule],
    templateUrl: './wait4me-button.html',
    styleUrls: ['./wait4me-button.css'],
})
export class Wait4MeButton {
    trip: PassengerTrip | null = null;

    public tripService = inject(OJPTrip);

    constructor(private router: Router) {
        const navigation = this.router.currentNavigation();
        this.trip = navigation?.extras.state?.['selectedTrip'] ?? null;
    }
}