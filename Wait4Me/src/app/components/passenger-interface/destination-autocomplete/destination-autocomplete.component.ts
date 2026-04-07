import { Component, input, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LocationSuggestion, OJPLocation } from '../../../services/ojp-location';
import { OJPTrip } from '../../../services/ojp-trip';

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

  destinations: LocationSuggestion[] = [];
  showSuggestions = false;

  constructor(private ojpService: OJPLocation) {}

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
      sessionStorage.setItem('origin_name', destination.stopPlaceName);
      sessionStorage.setItem('origin_id', destination.stopPlaceRef);
      this.tripService.originId.set(destination.stopPlaceRef);
      this.tripService.originName.set(destination.stopPlaceName);
    }
    if (this.placeholder() == "To") {
      sessionStorage.setItem('destination_name', destination.stopPlaceName);
      sessionStorage.setItem('destination_id', destination.stopPlaceRef);
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


