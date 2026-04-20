import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { W4MPassengerService } from '../../../shared/services/w4m-service-passenger';

@Component({
    selector: 'w4m-button',
    imports: [CommonModule],
    templateUrl: './wait4me-button.html',
    styleUrls: ['./wait4me-button.css', '../../../app.css'],
})
export class Wait4MeButton {
    public w4mService = inject(W4MPassengerService);

    cancel_request() {
        // TODO: Pop Up asking if user is sure
        console.log('user wants to cancel');
        this.w4mService.cancel_request();
    }
}