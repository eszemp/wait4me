import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { W4MPassengerService } from '../../../shared/services/w4m-service-passenger';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { Router } from '@angular/router';
import { PassengerTimedLeg, PassengerTransferLeg } from '../../../shared/types/PassengerTripTypes';

@Component({
    selector: 'w4m-button',
    imports: [CommonModule],
    templateUrl: './wait4me-button.html',
    styleUrls: ['./wait4me-button.css', '../../../app.css'],
})
export class Wait4MeButton {
    public w4mService = inject(W4MPassengerService);
    public tripService = inject(OJPTrip);
    private router = inject(Router);

    cancel_request() {
        // TODO: Pop Up asking if user is sure
        console.log('user wants to cancel');
        this.w4mService.cancel_request();
    }

    search_alternative_route() {
        // set trip service params for new routing from stop with broken transfer
        const failed_transfer_leg_id = this.w4mService.trip!.criticalTransferId!;
        const timedLegs = this.w4mService.trip!.legs.filter((leg): leg is PassengerTimedLeg => leg.kind === 'timed');
        const next_leg = timedLegs.find(leg => leg.id === failed_transfer_leg_id + 1);
        const last_leg = timedLegs[timedLegs.length - 1];

        this.tripService.originName.set(next_leg!.boardStopName);
        this.tripService.destinationName.set(last_leg!.alightStopName);

        const new_departure = this.w4mService.trip!.criticalTransfer?.requestedDelay.addToDate(
            this.w4mService.trip!.criticalTransfer?.scheduledOutgoingDeparture
        );
        if (new_departure) {
            const day = new_departure.toISOString().split('T')[0]; 
            const time = new_departure.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            }); 
            this.tripService.departureDay.set(day);         // YYYY-MM-DD
            this.tripService.departureTimeOfDay.set(time);  // HH:MM
        }
        this.w4mService.status.set('inactive');
        this.router.navigate(['/passenger']);
    }
}