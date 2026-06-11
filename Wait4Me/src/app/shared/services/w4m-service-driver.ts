import { Injectable, WritableSignal, signal, computed } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { PostResponse, GetRequestResponse } from '../types/Wait4MeRequest';
import { BACKEND_URL } from '../config/backend';
import { HttpClient } from '@angular/common/http';
import type { MapRequestIdsToDelays, IncomingRequestState } from '../types/w4m-driver-types';

@Injectable({ providedIn: 'root' })
export class W4MDriverService {
  public requestIds: WritableSignal<IncomingRequestState> = signal({});
  public activeStopRef: WritableSignal<string | null> = signal(null);
  public activeStopName: WritableSignal<string | null> = signal(null);
  public currentDepTime: WritableSignal<Date | null> = signal(null);
  public editMode: WritableSignal<Boolean> = signal(false);
  public hideEditMode: WritableSignal<Boolean> = signal(false);
  public busy: WritableSignal<Boolean> = signal(false);
  public smallestRequestedDelays: WritableSignal<{ [stopRef: string]: number }> = signal({});
  public acceptedDelays: WritableSignal<{ [stopRef: string]: number }> = signal({});
  public additionalDelaysAnySource: WritableSignal<{ [stopRef: string]: number }> = signal({});
  public declinedDelays: WritableSignal<{ [stopRef: string]: number }> = signal({});
  public stopSequence: WritableSignal<string[]> = signal([]);
  public delayImpactRating: WritableSignal<{ [stopRef: string]: { [delay: number]: string } }> =
    signal({});

  public activeRequestIds = computed(() => {
    const stopRef = this.activeStopRef();
    return stopRef ? (this.requestIds()[stopRef] ?? {}) : {};
  });
  public numberOfStacks = computed(() => Object.keys(this.activeRequestIds()).length);

  constructor(private http: HttpClient) {}

  async query_all_requests(journey_ref: string, stop_ref: string): Promise<void> {
    this.busy.set(true);
    this.activeStopRef.set(stop_ref);
    try {
      const response = await lastValueFrom(
        this.http.get<GetRequestResponse>(
          `${BACKEND_URL}/driver/get-requests?transfer_stop_ref=${stop_ref}&outgoing_service=${journey_ref}`,
        ),
      );

      if (response.cancelled_requests) {
        const requestsByDelay = response.cancelled_requests.reduce(
          (acc: { [key: number]: string[] }, data: any) => {
            const minutes = data.requested_delay_min;
            if (!acc[minutes]) {
              acc[minutes] = [];
            }
            acc[minutes].push(data.request_id);
            return acc;
          },
          {},
        );
        await this.handle_cancelled_requests(requestsByDelay, stop_ref);
      }

      if (response.incoming_requests) {
        const requestsByDelay: { [key: number]: string[] } = {};
        const impactsByDelay: { [key: number]: string } = {};

        response.incoming_requests.forEach((data: any) => {
          const minutes = data.requested_delay_min;
          if (!requestsByDelay[minutes]) {
            requestsByDelay[minutes] = [];
            // Store the impact rating for this specific delay bucket
            impactsByDelay[minutes] = data.delay_impact;
          }
          requestsByDelay[minutes].push(data.request_id);
        });

        await this.handle_pending_requests(requestsByDelay, impactsByDelay, stop_ref);
      }
    } catch (error) {
      console.error('DB Query of all requests failed:', error);
      this.busy.set(false);
      return;
    }
    this.busy.set(false);
    return;
  }

  private async handle_cancelled_requests(
    requestsByDelay: { [key: number]: string[] },
    stop_ref: string,
  ) {
    // Update requestIds signal by removing the specific IDs provided in the cancellation
    this.requestIds.update((state) => {
      if (!state[stop_ref]) return state;

      const newState = { ...state };
      const updatedStopData = { ...newState[stop_ref] };

      Object.keys(requestsByDelay).forEach((delayStr) => {
        const delay = Number(delayStr);
        if (updatedStopData[delay]) {
          // Filter out the cancelled IDs from this delay bucket
          const cancelledIds = new Set(requestsByDelay[delay]);
          updatedStopData[delay] = updatedStopData[delay].filter((id) => !cancelledIds.has(id));

          // If the bucket is now empty, remove the delay key entirely
          if (updatedStopData[delay].length === 0) {
            delete updatedStopData[delay];
            this.cleanupStopData(stop_ref, delay);
          }
        }
      });

      newState[stop_ref] = updatedStopData;
      return newState;
    });

    // Recalculate smallestRequestedDelays based on the updated state
    this.smallestRequestedDelays.update((state) => {
      const newState = { ...state };
      const currentRequests = this.requestIds()[stop_ref] ?? {};
      const remainingDelays = Object.keys(currentRequests)
        .map(Number)
        .sort((a, b) => a - b);

      if (remainingDelays.length > 0) {
        newState[stop_ref] = remainingDelays[0];
      } else {
        // If no requests left for this stop, remove it from the smallest delays map
        delete newState[stop_ref];
      }
      return newState;
    });

    // in case of a currently enabled edit mode for this stop
    if (this.editMode() && this.activeStopRef() === stop_ref) {
      // exit edit mode if there are now no requests left
      if (this.numberOfStacks() == 0) {
        await this.closeEditMode();
      }
    }
  }

  private async handle_pending_requests(
    requestsByDelay: { [key: number]: string[] },
    impactsByDelay: { [key: number]: string },
    stop_ref: string,
  ) {
    // handle pending requests by comparing to already handled delays
    for (const delayStr of Object.keys(requestsByDelay)) {
      const delay = Number(delayStr);
      console.log('Pending requests for', delay, 'minutes');

      // accept requests for delays smaller / equal to already accepted delays
      if (this.additionalDelaysAnySource()[stop_ref]) {
        const biggest_accepted_delay = this.additionalDelaysAnySource()[stop_ref];
        console.log(
          'Accept incoming requests for delays smaller/equal to already accepted',
          biggest_accepted_delay,
          'minutes',
        );
        if (delay <= biggest_accepted_delay) {
          await this.post_changes_to_db(requestsByDelay[delay], 'accepted');
          delete requestsByDelay[delay];
        }
      }

      // decline requests for delays bigger / equal to already declined delays
      if (this.declinedDelays()[stop_ref]) {
        const smallest_declined_delay = this.declinedDelays()[stop_ref];
        console.log(
          'Decline incoming requests for delays bigger/equal to already declined',
          smallest_declined_delay,
          'minutes',
        );
        if (delay >= smallest_declined_delay) {
          await this.post_changes_to_db(requestsByDelay[delay], 'declined');
          delete requestsByDelay[delay];
        }
      }
    }

    // store new pending requests in signals
    // update requestIds signal for this stop
    this.requestIds.update((state) => {
      let newState = { ...state };

      if (newState[stop_ref]) {
        // MERGE: Stop exists, merge delay bundles
        const existingStopData = { ...newState[stop_ref] };
        Object.keys(requestsByDelay).forEach((delay) => {
          const delayNum = Number(delay);
          if (existingStopData[delayNum]) {
            existingStopData[delayNum] = [
              ...new Set([...existingStopData[delayNum], ...requestsByDelay[delayNum]]),
            ];
          } else {
            existingStopData[delayNum] = requestsByDelay[delayNum];
          }
        });
        newState[stop_ref] = existingStopData;
      } else {
        // CREATE: New entry for this stop
        newState[stop_ref] = requestsByDelay;
      }
      return newState;
    });

    this.delayImpactRating.update((state) => {
      const newState = { ...state };
      newState[stop_ref] = { ...(newState[stop_ref] ?? {}), ...impactsByDelay };
      return newState;
    });

    // update smallest requested delay signal
    this.smallestRequestedDelays.update((state) => {
      let newState = { ...state };
      if (Object.keys(this.activeRequestIds()).length != 0) {
        const delays = Object.keys(this.activeRequestIds())
          .map(Number)
          .sort((a, b) => a - b);
        newState[stop_ref] = delays[0];
      }
      return newState;
    });
  }

  public async openEditMode(stopRef: string, stopName: string, depTime: Date) {
    while (this.busy()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.activeStopRef.set(stopRef);
    this.activeStopName.set(stopName);
    this.currentDepTime.set(depTime);
    this.editMode.set(true);
    console.log(
      'enabled edit mode for requests at stop',
      this.activeStopName(),
      'with ref',
      this.activeStopRef(),
      'departing at',
      this.currentDepTime(),
    );
  }

  public async closeEditMode(): Promise<void> {
    this.hideEditMode.set(false);
    this.busy.set(false);
    this.editMode.set(false);
    console.log('closed edit mode');
    return;
  }

  private async post_changes_to_db(ids: string[], new_status: string) {
    for (const id of ids) {
      try {
        const response = await lastValueFrom(
          this.http.post<PostResponse>(`${BACKEND_URL}/update-request/${id}`, {
            status: new_status,
          }),
        );
        if (response.api_status === 'changed') {
          console.log(`successfully ${new_status} request with id ${id}`);
        }
      } catch (error) {
        console.error(`request not ${new_status}:`, error);
      }
    }
  }

  private async change_request_status(new_status: string): Promise<void> {
    const stopRef = this.activeStopRef()!;
    const delay = this.smallestRequestedDelays()[stopRef];
    if (!stopRef || delay === null) return;

    await this.post_changes_to_db(this.activeRequestIds()[delay], new_status);

    this.requestIds.update((state) => {
      const newState = { ...state };
      const newStopMap = { ...newState[stopRef] };
      delete newStopMap[delay];
      this.cleanupStopData(stopRef, delay);
      newState[stopRef] = newStopMap;
      return newState;
    });

    this.smallestRequestedDelays.update((state) => {
      let newState = { ...state };
      if (Object.keys(this.activeRequestIds()).length != 0) {
        const delays = Object.keys(this.activeRequestIds())
          .map(Number)
          .sort((a, b) => a - b);
        newState[stopRef] = delays[0];
      } else {
        delete newState[stopRef];
      }
      return newState;
    });

    if (new_status === 'accepted') {
      this.acceptedDelays.update((state) => {
        let newState = { ...state };
        newState[stopRef] = delay;
        return newState;
      });
      console.log('updated signal acceptedDelays', this.acceptedDelays());

      this.additionalDelaysAnySource.update((state) => {
        let newState = { ...state };
        newState[stopRef] = delay;

        // Find current stop in sequence and apply delay to all subsequent stops
        const sequence = this.stopSequence();
        const currentIndex = sequence.indexOf(stopRef);

        if (currentIndex !== -1) {
          for (let i = currentIndex + 1; i < sequence.length; i++) {
            const downstreamStopRef = sequence[i];
            // Only update if the new delay is larger than what was previously accepted for that stop
            const existingDelay = newState[downstreamStopRef] || 0;
            if (delay > existingDelay) {
              newState[downstreamStopRef] = delay;
              console.log(
                `Propagated accepted delay of ${delay}m to downstream stop: ${downstreamStopRef}`,
              );
            }
          }
        }
        return newState;
      });
      console.log('updated signal additionalDelaysAnySource', this.additionalDelaysAnySource());
    }

    if (new_status === 'declined') {
      this.declinedDelays.update((state) => {
        let newState = { ...state };
        newState[stopRef] = delay;
        return newState;
      });
      console.log('updated signal declinedDelays', this.declinedDelays());
    }
  }

  public async accept_request(): Promise<void> {
    await this.change_request_status('accepted');
    this.hideEditMode.set(true);
    if (this.numberOfStacks() > 0) {
      // edit bar reappears for next bundle after short delay
      console.log('staying in edit mode after accepting');
      setTimeout(() => this.hideEditMode.set(false), 200);
      return;
    }
    await this.closeEditMode();
    return;
  }

  public async decline_request(): Promise<void> {
    await this.change_request_status('declined');
    while (this.numberOfStacks() > 0) {
      console.log('declining bigger open requests');
      await this.change_request_status('declined');
      console.log('successfully declined bigger open requests');
    }
    await this.closeEditMode();
    return;
  }

  private cleanupStopData(stop_ref: string, delay: number) {
    // Remove impact rating if no IDs remain for that delay
    this.delayImpactRating.update((state) => {
      if (!state[stop_ref] || state[stop_ref][delay] === undefined) return state;

      const newState = { ...state };
      const updatedStopImpacts = { ...newState[stop_ref] };

      // Check if there are still active requests for this delay
      const remainingRequests = this.requestIds()[stop_ref]?.[delay] || [];
      if (remainingRequests.length === 0) {
        delete updatedStopImpacts[delay];
      }

      if (Object.keys(updatedStopImpacts).length === 0) {
        delete newState[stop_ref];
      } else {
        newState[stop_ref] = updatedStopImpacts;
      }
      return newState;
    });
  }

  get_delay_impact_rating(stopRef: string, delay: number): string {
    return this.delayImpactRating()[stopRef][delay];
  }
}
