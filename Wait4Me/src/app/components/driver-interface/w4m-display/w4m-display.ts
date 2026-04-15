import { Component, inject, Input } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { W4MDriverService } from '../../../services/w4m-driver';
import { OJPLocation } from '../../../services/ojp-location';


@Component({
    selector: 'w4m-display',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './w4m-display.html',
    styleUrls: ['./w4m-display.css', '../../../app.css'],
})
export class Wait4MeDisplay {

    @Input({ required: true }) stopName!: string;
    @Input({ required: true }) serviceJourneyRef!: string;

    stopRef: string | null = null;

    public w4mService = inject(W4MDriverService);
    locationService = inject(OJPLocation);

    async ngOnInit() {
        const suggestions = await firstValueFrom(
        this.locationService.getLocationInformation(this.stopName, 1)
        );

        this.stopRef = suggestions[0]?.stopPlaceRef ?? '';

        await new Promise(resolve => setTimeout(resolve, 1200));
        
        console.log('Stop Ref initialized:', this.stopRef);
    }
}