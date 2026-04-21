import { Component, inject, Input } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { W4MDriverService } from '../../../shared/services/w4m-service-driver';
import { OJPLocation } from '../../../shared/services/ojp-location';
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
    currentlyRequestedDelay : number = 0;

    public w4mService = inject(W4MDriverService);
    locationService = inject(OJPLocation);

    async ngOnInit() {
        await this.get_stop_ref();
        console.log(this.w4mService.busy());
        while(this.w4mService.busy()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.currentlyRequestedDelay = await this.query_db();
    }

    private async get_stop_ref(): Promise<void> {
        const suggestions = await firstValueFrom(
        this.locationService.getLocationInformation(this.stopName, 1)
        );

        this.stopRef = suggestions[0]?.stopPlaceRef ?? '';

        await new Promise(resolve => setTimeout(resolve, 1200));
        console.log('Stop Ref initialized:', this.stopRef);
    }

    private async query_db(): Promise<number> {
        const smallestDelay = await this.w4mService.query_all_requests(this.serviceJourneyRef, this.stopRef);
        console.log("Request IDs", this.w4mService.requestIds());
        console.log("Active Stop Ref", this.w4mService.activeStopRef());
        console.log("Active Request IDs", this.w4mService.activeRequestIds());
        console.log("Number of Stacks", this.w4mService.numberOfStacks());
        if (this.w4mService.numberOfStacks()===0) {
            this.state = 'No requests';
        }
        else {
            this.state = 'open';
        }
        return smallestDelay;
        // TODO: visualize request stack based on w4mService.numberOfStacks()
    }
    process_requests_for_this_stop(): void {
        this.w4mService.openEditMode(this.stopRef);
        console.log("enabled edit mode for requests at stop", this.stopName );
        return;
    }
}