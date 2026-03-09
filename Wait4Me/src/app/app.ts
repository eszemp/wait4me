import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly destinations: string[] = [
    'Zurich HB',
    'Zurich Oerlikon',
    'Basel SBB',
    'Bern',
    'Luzern',
    'Winterthur',
    'St. Gallen',
    'Lausanne',
    'Geneve',
    'Zug'
  ];

  filteredFromDestinations: string[] = [];
  filteredToDestinations: string[] = [];
  showFromSuggestions = false;
  showToSuggestions = false;

  readonly tripForm = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    date: new FormControl(this.getDefaultDate(), { nonNullable: true }),
    time: new FormControl(this.getDefaultTime(), { nonNullable: true })
  });

  onFromQueryChange(query: string): void {
    this.filteredFromDestinations = this.filterDestinations(query);
    this.showFromSuggestions = true;
  }

  onToQueryChange(query: string): void {
    this.filteredToDestinations = this.filterDestinations(query);
    this.showToSuggestions = true;
  }

  selectFromDestination(destination: string): void {
    this.tripForm.controls.from.setValue(destination);
    this.showFromSuggestions = false;
  }

  selectToDestination(destination: string): void {
    this.tripForm.controls.to.setValue(destination);
    this.showToSuggestions = false;
  }

  closeFromSuggestions(): void {
    setTimeout(() => {
      this.showFromSuggestions = false;
    }, 120);
  }

  closeToSuggestions(): void {
    setTimeout(() => {
      this.showToSuggestions = false;
    }, 120);
  }

  private filterDestinations(query: string): string[] {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      return this.destinations;
    }

    return this.destinations.filter((destination) =>
      destination.toLowerCase().includes(cleanQuery)
    );
  }

  private getDefaultDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getDefaultTime(): string {
    const now = new Date();
    const hours = `${now.getHours()}`.padStart(2, '0');
    const minutes = `${now.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
