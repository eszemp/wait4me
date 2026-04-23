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
  public hideEditMode : WritableSignal<Boolean> = signal(false);
  public busy : WritableSignal<Boolean> = signal(false);
  public smallestRequestedDelays : WritableSignal<{ [stopRef: string]: number }> = signal({});
  public acceptedDelays: WritableSignal<{ [stopRef: string]: number }> = signal({});

  public activeRequestIds = computed(() => {
    const stopRef = this.activeStopRef();
    return stopRef ? this.requestIds()[stopRef] ?? {} : {};
  });
  public numberOfStacks = computed(() => Object.keys(this.activeRequestIds()).length);
  

  constructor(private http: HttpClient) {}

  async query_all_requests(journey_ref: string, stop_ref: string): Promise<void> {
    if (this.editMode()) {
      return;
    }
    this.busy.set(true);
    this.activeStopRef.set(stop_ref);
    try {
      const response = await lastValueFrom(
        this.http.get<GetRequestResponse>(`${BACKEND_URL}/driver/get-requests?transfer_stop_ref=${stop_ref}&outgoing_service=${journey_ref}`)
      );

      // console.log('API Response:', response);

      if (response.api_status === "No incoming connections" || !response.data) {
        this.busy.set(false);
        return;
      }

      const requestsByDelay = response.data.reduce((acc: { [key: number]: string[] }, data: any) => {
        
        const minutes = data.requested_delay_min;
        if (!acc[minutes]) {
          acc[minutes] = []; // init empty array if no entry for this duration exists
        }
        acc[minutes].push(data.request_id);
        return acc;

      }, {});

      // console.log('Grouped Requests:', requestsByDelay);
  

      // update requestIds signal for this stop    
      this.requestIds.update(state => {
        let newState = { ...state };
        
        if (newState[stop_ref]) {
          // MERGE: Stop exists, merge delay bundles
          const existingStopData = { ...newState[stop_ref] };
          Object.keys(requestsByDelay).forEach(delay => {
            const delayNum = Number(delay);
            if (existingStopData[delayNum]) {
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
      this.smallestRequestedDelays.update(state => {
        let newState = { ...state };
        if (Object.keys(this.activeRequestIds()).length!=0) {
          const delays = Object.keys(this.activeRequestIds()).map(Number).sort((a, b) => a - b);
          newState[stop_ref] = delays[0];
        }
        return newState;
      });
    } catch (error) {
      console.error('DB Query of all requests failed:', error);
      this.busy.set(false);
      return;
    }
    this.busy.set(false);
    return;
  }

  public async openEditMode(stopRef: string) {
    while(this.busy()) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.activeStopRef.set(stopRef);
    this.editMode.set(true);
  }

  public async closeEditMode() : Promise<void> {
    this.hideEditMode.set(false);
    this.busy.set(false);
    this.editMode.set(false);
    console.log("closed edit mode");
    return;
  };


  async change_request_status(new_status: string) : Promise<void> {

    const stopRef = this.activeStopRef()!;
    const delay = this.smallestRequestedDelays()[stopRef];
    if (!stopRef || delay === null) return;

    for (const id of this.activeRequestIds()[delay]) {
      try {
        const response = await lastValueFrom(this.http.post<PostResponse>(`${BACKEND_URL}/update-request/${id}`, {status: new_status}));
        if (response.api_status === 'changed') {
          console.log(`successfully ${new_status} request with id ${id}`);
        }
      } catch (error) {
        console.error(`request not ${new_status}:`, error);
      }
    }

    this.requestIds.update(state => {
      const newState = { ...state };
      const newStopMap = { ...newState[stopRef] };
      delete newStopMap[delay];
      newState[stopRef] = newStopMap;
      return newState;
    });
    //console.log("updated signal requestIDs", this.requestIds());

    this.smallestRequestedDelays.update(state => {
        let newState = { ...state };
        if (Object.keys(this.activeRequestIds()).length!=0) {
          const delays = Object.keys(this.activeRequestIds()).map(Number).sort((a, b) => a - b);
          newState[stopRef] = delays[0];
        }
        else {
          delete newState[stopRef];
        }
        return newState;
    });
    //console.log("updated signal smallestRequestedDelays", this.smallestRequestedDelays());

    if (new_status=='accepted') {
      this.acceptedDelays.update(state => {
          let newState = { ...state };
          newState[stopRef] = delay;
          return newState;
      });
    //console.log("updated signal acceptedDelays", this.acceptedDelays());
    }

  }

  public async accept_request() : Promise<void> {
    await this.change_request_status('accepted');
    this.hideEditMode.set(true);
    if (this.numberOfStacks() > 0) {
      // edit bar reappears for next bundle after short delay
      console.log("staying in edit mode after accepting");
      setTimeout(() => this.hideEditMode.set(false), 200);
      return;
    }
    await this.closeEditMode();
    return;
  }

  public async decline_request() : Promise<void> {
    await this.change_request_status('declined');
    while (this.numberOfStacks() > 0) {
      console.log("declining bigger open requests");
      await this.change_request_status('declined');
      console.log("successfully declined bigger open requests");
    }
    await this.closeEditMode();
    return;
  }
  
}
