import { Injectable, WritableSignal, signal, computed } from '@angular/core';
import { lastValueFrom} from 'rxjs';
import { PostResponse, GetRequestResponse, BACKEND_URL } from '../types/Wait4MeRequest';
import { HttpClient } from '@angular/common/http';


export type MapRequestIdsToDelays = { [delay: number]: string[] };
export type IncomingRequestState = { [stopRef: string]: MapRequestIdsToDelays };

@Injectable({ providedIn: 'root' })
export class W4MDriverService {


  public requestIds : WritableSignal<IncomingRequestState> = signal({});
  public activeStopRef : WritableSignal<string | null> = signal(null);
  public editMode : WritableSignal<Boolean> = signal(false);
  public busy : WritableSignal<Boolean> = signal(false);

  public activeRequestIds = computed(() => {
    console.log("active request ids updated");
    const stopRef = this.activeStopRef();
    console.log("stopRef", stopRef);
    console.log("request ids", this.requestIds());
    console.log(this.requestIds()[stopRef!]);
    return stopRef ? this.requestIds()[stopRef] ?? {} : {};
  });
  public numberOfStacks = computed(() => Object.keys(this.activeRequestIds()).length);
  public smallestRequestedDelay = computed(() => {
    if (Object.keys(this.activeRequestIds()).length===0) {
      return 0;
    }
    else {
      const delays = Object.keys(this.activeRequestIds()).map(Number).sort((a, b) => a - b);
      return delays[0];
    }
  });


  constructor(private http: HttpClient) {}

  async query_all_requests(journey_ref: string, stop_ref: string): Promise<number> {
    this.busy.set(true);
    this.activeStopRef.set(stop_ref);
    console.log("Check incoming requests for: ");
    console.log("Jouney Ref:", journey_ref);
    console.log("Stop Ref: ", stop_ref);
    try {
      const response = await lastValueFrom(
        this.http.get<GetRequestResponse>(`${BACKEND_URL}/driver/get-requests?transfer_stop_ref=${stop_ref}&outgoing_service=${journey_ref}`)
      );

      console.log('API Response:', response);

      if (response.api_status === "No incoming connections" || !response.data) {
        this.busy.set(false);
        return 0;
      }

      const requestsByDelay = response.data.reduce((acc: { [key: number]: string[] }, data: any) => {
        
        const minutes = data.requested_delay_min;
        if (!acc[minutes]) {
          acc[minutes] = []; // init empty array if no entry for this duration exists
        }
        acc[minutes].push(data.request_id);
        return acc;

      }, {});

      console.log('Grouped Requests:', requestsByDelay);
  

      // update requestIds signal for this stop    
      this.requestIds.update(state => {
        const newState = { ...state };
        
        if (newState[stop_ref]) {
          // MERGE: Stop exists, merge delay bundles
          const existingStopData = { ...newState[stop_ref] };
          
          Object.keys(requestsByDelay).forEach(delay => {
            const delayNum = Number(delay);
            if (existingStopData[delayNum]) {
              // combine arrays and remove duplicates
              existingStopData[delayNum] = [...new Set([...existingStopData[delayNum], ...requestsByDelay[delayNum]])];
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

    } catch (error) {
      console.error('DB Query of all requests failed:', error);
      this.busy.set(false);
      return 0;
    }
    this.busy.set(false);
    return this.smallestRequestedDelay()!;
  }


  public openEditMode(stopRef: string) {
    this.activeStopRef.set(stopRef);
    this.editMode.set(true);
  }

  public async closeEditMode() : Promise<void> {
    this.activeStopRef.set(null);
    this.editMode.set(false);
    return;
  };


  async change_request_status(new_status: string) : Promise<void> {


    const stopRef = this.activeStopRef();
    const delay = this.smallestRequestedDelay();
    if (!stopRef || delay === null) return;

    for (const id of this.activeRequestIds()[delay]) {
      try {
        const response = await lastValueFrom(this.http.post<PostResponse>(`${BACKEND_URL}/update-request/${id}`, {status: new_status}));
        if (response.api_status === 'changed') {
          console.log(`successfully ${new_status} request with id ${id}`);
        }
        console.error(`request not ${new_status}, backend did not confirm change:`, response.api_status);
      } catch (error) {
        console.error(`request not ${new_status}:`, error);
      }
    }

    // UPDATE STATE: Remove the processed delay bundle from this specific stop
    this.requestIds.update(state => {
      const newState = { ...state };
      const newStopMap = { ...newState[stopRef] };
      delete newStopMap[delay];
      newState[stopRef] = newStopMap;
      return newState;
    });

  }

  public async accept_request() : Promise<void> {
    await this.change_request_status('accepted');
    this.closeEditMode();

    if (this.numberOfStacks() > 0) {
      // Re-open for next bundle after short delay
      setTimeout(() => this.openEditMode(this.activeStopRef()!), 500);
    }
  }

  public async decline_request() : Promise<void> {
    await this.change_request_status('declined');
    await this.closeEditMode();
    
    // If decline is clicked, we usually flush all remaining stacks for this stop
    while (this.numberOfStacks() > 0) {
      await this.change_request_status('declined');
    }
  }
  
}
