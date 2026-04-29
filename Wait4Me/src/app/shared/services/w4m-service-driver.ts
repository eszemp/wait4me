import { Injectable, WritableSignal, signal, computed } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { PostResponse, GetRequestResponse, BACKEND_URL } from '../types/Wait4MeRequest';
import { HttpClient } from '@angular/common/http';

export type MapRequestIdsToDelays = { [delay: number]: string[] };
export type IncomingRequestState = { [stopRef: string]: MapRequestIdsToDelays };

@Injectable({ providedIn: 'root' })
export class W4MDriverService {
  public requestIds: WritableSignal<IncomingRequestState> = signal({});
  public activeStopRef: WritableSignal<string | null> = signal(null);
  public editMode: WritableSignal<Boolean> = signal(false);
  public hideEditMode: WritableSignal<Boolean> = signal(false);
  public busy: WritableSignal<Boolean> = signal(false);
  public smallestRequestedDelays: WritableSignal<{ [stopRef: string]: number }> = signal({});
  public acceptedDelays: WritableSignal<{ [stopRef: string]: number }> = signal({});
  public declinedDelays: WritableSignal<{ [stopRef: string]: number }> = signal({});

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
        const requestsByDelay = response.incoming_requests.reduce(
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

        await this.handle_pending_requests(requestsByDelay, stop_ref);
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
    stop_ref: string,
  ) {
    // handle pending requests by comparing to already handled delays
    for (const delayStr of Object.keys(requestsByDelay)) {
      const delay = Number(delayStr);
      console.log('Pending requests for', delay, 'minutes');

      // accept requests for delays smaller / equal to already accepted delays
      if (this.acceptedDelays()[stop_ref]) {
        const biggest_accepted_delay = this.acceptedDelays()[stop_ref];
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

  public async openEditMode(stopRef: string) {
    while (this.busy()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.activeStopRef.set(stopRef);
    this.editMode.set(true);
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
      newState[stopRef] = newStopMap;
      return newState;
    });
    //console.log("updated signal requestIDs", this.requestIds());

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
    //console.log("updated signal smallestRequestedDelays", this.smallestRequestedDelays());

    if (new_status === 'accepted') {
      this.acceptedDelays.update((state) => {
        let newState = { ...state };
        newState[stopRef] = delay;
        return newState;
      });
      console.log('updated signal acceptedDelays', this.acceptedDelays());
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
}
