import { Component, inject, Input } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { W4MDriverService } from '../../../services/w4m-driver';
import { OJPLocation } from '../../../services/ojp-location';
import { Wait4MeRequest } from '../../../shared/types/Wait4MeRequest';



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

    stopRef: string = '';
    state: string = 'Loading...';
    open_requests: Wait4MeRequest[] | null = null;
    current_request: Wait4MeRequest | null = null;

    public w4mService = inject(W4MDriverService);
    locationService = inject(OJPLocation);

    async ngOnInit() {

        await this.get_stop_ref();
        this.query_db();
    }

    private async get_stop_ref(): Promise<void> {
        const suggestions = await firstValueFrom(
        this.locationService.getLocationInformation(this.stopName, 1)
        );

        this.stopRef = suggestions[0]?.stopPlaceRef ?? '';

        await new Promise(resolve => setTimeout(resolve, 1200));
        console.log('Stop Ref initialized:', this.stopRef);
    }

    private async query_db(): Promise<void> {
        this.w4mService.set_params(this.serviceJourneyRef, Number(this.stopRef));
        this.open_requests = await this.w4mService.get_all_requests();
        if (this.open_requests.length===0) {
            this.state = 'No requests';
        }
        else {
            this.state = 'open';
            this.current_request = this.open_requests[0]
        }
    }
}