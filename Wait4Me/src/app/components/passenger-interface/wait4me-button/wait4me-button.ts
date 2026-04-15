import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { W4MPassengerService } from '../../../services/w4m-passenger';

@Component({
    selector: 'w4m-button',
    imports: [CommonModule],
    templateUrl: './wait4me-button.html',
    styleUrls: ['./wait4me-button.css'],
})
export class Wait4MeButton {
    public w4mService = inject(W4MPassengerService);

}