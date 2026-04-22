import { Component, input, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LocationSuggestion, OJPLocation } from '../../../shared/services/ojp-location';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-destination-autocomplete',
  imports: [ReactiveFormsModule],
  templateUrl: './destination-autocomplete.component.html',
  styleUrl: './destination-autocomplete.component.css'
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
      if (this.tripService.originName() && this.tripService.destinationName()) {

        this.searchForLocation(this.tripService.originName()!);
        this.searchForLocation(this.tripService.destinationName()!);

        setTimeout(() => {
          const origin_id = this.destinations[0]!.stopPlaceRef;
          this.tripService.originId.set(origin_id);
          const destination_id = this.destinations[0]!.stopPlaceRef;
          this.tripService.destinationId.set(destination_id);
        }, 1000);
      }
    })();
  }

  searchForLocation(loc_name: string) : void {
    this.ojpService.getLocationInformation(loc_name).subscribe({
      next: (response) => {
        this.destinations = response || [];
      },
      error: (err) => {
        console.error('API Error:', err);
        this.destinations = [];
      }
    });
  }

  onQueryChange(query: string): void {
    if (query.length <2) { //only start searching from min. 2 letters
      this.destinations = []
      return;
    }
    this.searchForLocation(query);
    this.showSuggestions = true;
  }

  selectDestination(destination: LocationSuggestion): void {
    this.control().setValue(destination.stopPlaceName);
    this.showSuggestions = false;
    if (this.placeholder() == "From") {
      this.tripService.originId.set(destination.stopPlaceRef);
      this.tripService.originName.set(destination.stopPlaceName);
    }
    if (this.placeholder() == "To") {
      this.tripService.destinationId.set(destination.stopPlaceRef);
      this.tripService.destinationName.set(destination.stopPlaceName);
    }
  }

  closeSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 120);
  }
  
}


