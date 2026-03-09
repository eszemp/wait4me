import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

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
  destinations = input.required<string[]>();

  filteredDestinations: string[] = [];
  showSuggestions = false;

  onQueryChange(query: string): void {
    this.filteredDestinations = this.filterDestinations(query);
    this.showSuggestions = true;
  }

  selectDestination(destination: string): void {
    this.control().setValue(destination);
    this.showSuggestions = false;
  }

  closeSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 120);
  }

  private filterDestinations(query: string): string[] {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      return this.destinations();
    }

    return this.destinations().filter((destination) =>
      destination.toLowerCase().includes(cleanQuery)
    );
  }
}
