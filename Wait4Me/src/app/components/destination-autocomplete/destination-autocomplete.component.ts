import { Component, input, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { OJPLocation } from '../../services/ojp-location';
import { OJPTrip } from '../../services/ojp-trip';

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

  destinations: { StopPlaceName: string; StopPlaceRef: string }[] = [];
  showSuggestions = false;

  constructor(private ojpService: OJPLocation) {}

  searchForLocation(loc_name: string) : void {
    this.ojpService.getLocationInformation(loc_name).subscribe({
      next: (response) => {
        const list = response || [];
        this.destinations = list.map((dest: any) => ({
          StopPlaceName: dest.Place?.StopPlace?.StopPlaceName?.Text ?? '',
          StopPlaceRef: dest.Place?.StopPlace?.StopPlaceRef ?? ''
        }));
        // console.log(this.destinations)
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

  selectDestination(destination: { StopPlaceName: string; StopPlaceRef: string }): void {
    this.control().setValue(destination.StopPlaceName);
    this.showSuggestions = false;
    if (this.placeholder() == "From") {
      sessionStorage.setItem('origin_name', destination.StopPlaceName);
      sessionStorage.setItem('origin_id', destination.StopPlaceRef);
      this.tripService.originId.set(destination.StopPlaceRef);
    }
    if (this.placeholder() == "To") {
      sessionStorage.setItem('destination_name', destination.StopPlaceName);
      sessionStorage.setItem('destination_id', destination.StopPlaceRef);
      this.tripService.destinationId.set(destination.StopPlaceRef);
    }
  }

  closeSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 120);
  }

  
}


