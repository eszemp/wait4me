import { Component, inject, Input} from '@angular/core';
import { firstValueFrom, Subscription, timer, from, exhaustMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { W4MDriverService } from '../../../shared/services/w4m-service-driver';
import { OJPLocation } from '../../../shared/services/ojp-location';


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

    private incomingRequestsSubscription: Subscription | null = null;

    public w4mService = inject(W4MDriverService);
    locationService = inject(OJPLocation);


    async ngOnInit() {
        await this.get_stop_ref();
        console.log(this.w4mService.busy());
        this.startRequestPolling();
    }

    ngOnDestroy() {
        console.log('w4m display for', this.stopName, "is being destroyed. Cleaning up...");
        this.stopRequestPolling();
    }

    private startRequestPolling() {
        if (this.incomingRequestsSubscription) return;

        console.log("Polling incoming requests from db for", this.stopName);

        this.incomingRequestsSubscription = timer(0, 5000)
        .pipe(
            exhaustMap(() => from(this.executeWhenNotBusy()))
        )
        .subscribe({
            error: (err) => console.error('Polling failed:', err)
        });
    }

    private stopRequestPolling() {
        if (this.incomingRequestsSubscription) {
            this.incomingRequestsSubscription.unsubscribe();
        }
        return;
    }

    private async executeWhenNotBusy() {
        while (this.w4mService.busy() || (this.w4mService.editMode() && this.w4mService.activeStopRef() !== this.stopRef)) {
            console.log("components wait for service to have capacity. Busy:", this.w4mService.busy(), "Edit Mode:", this.w4mService.editMode());
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        await this.query_db();
        return;
    }

    private async get_stop_ref(): Promise<void> {
        const suggestions = await firstValueFrom(
        this.locationService.getLocationInformation(this.stopName, 1)
        );
        this.stopRef = suggestions[0]?.stopPlaceRef ?? '';
        await new Promise(resolve => setTimeout(resolve, 1200));
    }

    private async query_db(): Promise<void> {
        await this.w4mService.query_all_requests(this.serviceJourneyRef, this.stopRef);
        if (!this.hasOpenRequestForStop() && !this.hasAcceptedRequestForStop()) {
            this.state = 'No requests';
        }
        return;
    }

    hasOpenRequestForStop(): boolean {
        const requestsByDelay = this.w4mService.requestIds()[this.stopRef];
        return !!requestsByDelay && Object.keys(requestsByDelay).length > 0;
    }

    hasAcceptedRequestForStop(): boolean {
        return this.w4mService.acceptedDelays()[this.stopRef] !== undefined;
    }

    hasMultipleRequestsForStop(): boolean {
        const requestsByDelay = this.w4mService.requestIds()[this.stopRef];
        return !!requestsByDelay && Object.values(requestsByDelay).reduce((count, requestIds) => count + requestIds.length, 0) > 1;
    }

    async process_requests_for_this_stop(): Promise<void> {
        this.w4mService.openEditMode(this.stopRef);
        console.log("enabled edit mode for requests at stop", this.stopName );
        while (this.w4mService.editMode()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!this.hasOpenRequestForStop() && !this.hasAcceptedRequestForStop()) {
            this.state = 'No requests';
            console.log("no longer in edit mode, new_state: ", this.state);
        }
        return;
    }
}