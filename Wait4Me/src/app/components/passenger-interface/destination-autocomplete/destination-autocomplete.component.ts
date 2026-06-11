import { Component, input, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { OJPLocation } from '../../../shared/services/ojp-location';
import type { LocationSuggestion } from '../../../shared/types/ojp-types';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-destination-autocomplete',
  imports: [ReactiveFormsModule],
  templateUrl: './destination-autocomplete.component.html',
  styleUrl: './destination-autocomplete.component.css',
})
export class DestinationAutocompleteComponent {
  inputId = input.required<string>();
  placeholder = input.required<string>();
  control = input.required<FormControl<string>>();

  // inject the trip service to update signals
  private tripService = inject(OJPTrip);
  private locationService = inject(OJPLocation);

  destinations: LocationSuggestion[] = [];
  showSuggestions = false;

  constructor(private ojpService: OJPLocation) {
    //if tripService.originName and destinationName are set, but Ids not -> determine and set ids
    (async () => {
      // 1. Handle Origin
      const originName = this.tripService.originName();
      if (originName) {
        console.log('searching stopref for origin...');
        const results = await this.searchForLocation(originName);

        if (results.length > 0) {
          const origin_id = results[0].stopPlaceRef;
          this.tripService.originId.set(origin_id);
          console.log('Origin result:', origin_id);
        }
      }

      // 2. Handle Destination
      const destName = this.tripService.destinationName();
      if (destName) {
        console.log('searching stopref for destination...');
        const results = await this.searchForLocation(destName);

        if (results.length > 0) {
          const destination_id = results[0].stopPlaceRef;
          this.tripService.destinationId.set(destination_id);
          console.log('Destination result:', destination_id);
        }
      }
    })();
  }

  async searchForLocation(loc_name: string): Promise<LocationSuggestion[]> {
    try {
      // firstValueFrom converts the Observable to a Promise and takes the first emission
      const response = await firstValueFrom(this.ojpService.getLocationInformation(loc_name));
      return response || [];
    } catch (err) {
      console.error('API Error:', err);
      return [];
    }
  }

  async onQueryChange(query: string): Promise<void> {
    if (query.length < 1) {
      //only start searching from min. 2 letters
      this.destinations = [];
      return;
    }
    this.destinations = await this.searchForLocation(query);
    this.showSuggestions = true;
  }

  selectDestination(destination: LocationSuggestion): void {
    this.control().setValue(destination.stopPlaceName);
    this.showSuggestions = false;
    if (this.placeholder() == 'From') {
      this.tripService.originId.set(destination.stopPlaceRef);
      this.tripService.originName.set(destination.stopPlaceName);
    }
    if (this.placeholder() == 'To') {
      this.tripService.destinationId.set(destination.stopPlaceRef);
      this.tripService.destinationName.set(destination.stopPlaceName);
    }
  }

  closeSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 120);
  }

  clearInput(): void {
    this.control().setValue('');
    this.destinations = [];
    this.showSuggestions = false;

    if (this.placeholder() == 'From') {
      this.tripService.originId.set('');
      this.tripService.originName.set('');
    }

    if (this.placeholder() == 'To') {
      this.tripService.destinationId.set('');
      this.tripService.destinationName.set('');
    }

    this.tripService.tripResults.set([]);
    this.tripService.selectedConnectionTrip.set(null);
    this.tripService.isLoadingTrips.set(false);
  }
}
