import { Component, inject, Input } from '@angular/core';
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
  @Input({ required: true }) depTime!: Date;
  @Input({ required: true }) serviceJourneyRef!: string;

  stopRef: string = '';
  state: string = 'Loading...';

  private incomingRequestsSubscription: Subscription | null = null;

  public w4mService = inject(W4MDriverService);
  locationService = inject(OJPLocation);

  /** Initializes the stop reference and starts polling for incoming requests. */
  async ngOnInit() {
    await this.get_stop_ref();
    console.log(this.w4mService.busy());
    this.startRequestPolling();
  }

  /** Stops polling when the component is destroyed. */
  ngOnDestroy() {
    console.log('w4m display for', this.stopName, 'is being destroyed. Cleaning up...');
    this.stopRequestPolling();
  }

  /** Starts the polling loop unless it is already active. */
  private startRequestPolling() {
    if (this.incomingRequestsSubscription) return;

    console.log('Polling incoming requests from db for', this.stopName);

    this.incomingRequestsSubscription = timer(0, 5000)
      .pipe(exhaustMap(() => from(this.executeWhenNotBusy())))
      .subscribe({
        error: (err) => console.error('Polling failed:', err),
      });
  }

  /** Stops the active polling subscription. */
  private stopRequestPolling() {
    if (this.incomingRequestsSubscription) {
      this.incomingRequestsSubscription.unsubscribe();
    }
    return;
  }

  /** Waits until the service can process this stop, then refreshes request data. */
  private async executeWhenNotBusy() {
    while (
      this.w4mService.busy() ||
      (this.w4mService.editMode() && this.w4mService.activeStopRef() !== this.stopRef)
    ) {
      console.log(
        'components wait for service to have capacity. Busy:',
        this.w4mService.busy(),
        'Edit Mode:',
        this.w4mService.editMode(),
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await this.query_db();
    return;
  }

  /** Resolves the stop-place reference for the current stop name. */
  private async get_stop_ref(): Promise<void> {
    const suggestions = await firstValueFrom(
      this.locationService.getLocationInformation(this.stopName, 1),
    );
    this.stopRef = suggestions[0]?.stopPlaceRef ?? '';
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  /** Queries the backend for all requests for the current service journey and stop. */
  private async query_db(): Promise<void> {
    await this.w4mService.query_all_requests(this.serviceJourneyRef, this.stopRef);
    if (!this.hasOpenRequestForStop() && !this.hasAcceptedRequestForStop()) {
      this.state = 'No requests';
    }
    return;
  }

  /** Returns whether there are any open requests for this stop. */
  hasOpenRequestForStop(): boolean {
    const requestsByDelay = this.w4mService.requestIds()[this.stopRef];
    return !!requestsByDelay && Object.keys(requestsByDelay).length > 0;
  }

  /** Returns whether this stop has at least one accepted request. */
  hasAcceptedRequestForStop(): boolean {
    return this.w4mService.acceptedDelays()[this.stopRef] !== undefined;
  }

  /** Returns whether more than one request stack exists for this stop. */
  hasMultipleRequestsForStop(): boolean {
    return this.numberOfStacksForStop() > 1;
  }

  /** Returns the number of request stacks currently shown for this stop. */
  numberOfStacksForStop(): number {
    const requestsByDelay = this.w4mService.requestIds()[this.stopRef];
    return requestsByDelay ? Object.keys(requestsByDelay).length : 0;
  }

  /** Opens edit mode for this stop and waits until editing is finished. */
  async process_requests_for_this_stop(): Promise<void> {
    this.w4mService.openEditMode(this.stopRef, this.stopName, this.depTime);
    while (this.w4mService.editMode()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!this.hasOpenRequestForStop() && !this.hasAcceptedRequestForStop()) {
      this.state = 'No requests';
      console.log('no longer in edit mode, new_state: ', this.state);
    }
  }

  /** Returns the delay-impact rating for the current stop. */
  getImpactRating(): string {
    const delay = this.w4mService.smallestRequestedDelays()[this.stopRef];
    if (delay === undefined) {
      return 'small';
    }

    const rating = this.w4mService.get_delay_impact_rating(this.stopRef, delay);
    return rating || 'small';
  }
}
