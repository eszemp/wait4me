import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class W4MPassengerService {
  private currentTrip = new BehaviorSubject<any>(null);
  
  currentTrip$ = this.currentTrip.asObservable();

  updateTrip(trip: any) {
    this.currentTrip.next(trip);
  }
}