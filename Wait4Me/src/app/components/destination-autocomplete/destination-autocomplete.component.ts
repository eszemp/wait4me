import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { OjpService } from '../../services/ojp';

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

  destinations: { StopPlaceName: string; StopPlaceRef: string }[] = [];
  showSuggestions = false;

  constructor(private ojpService: OjpService) {}

  searchForLocation(loc_name: string) : void {
    this.ojpService.getLocationInformation(loc_name).subscribe({
      next: (response) => {
        // Transformiere die Destination-Liste
        const list = response || [];
        this.destinations = list.map((dest: any) => ({
          StopPlaceName: dest.Place?.StopPlace?.StopPlaceName?.Text ?? '',
          StopPlaceRef: dest.Place?.StopPlace?.StopPlaceRef ?? ''
        }));
        console.log(this.destinations)
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
  }

  closeSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 120);
  }

  
}


