import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StopLookupResult } from '../../../shared/types/DriverDeparturesTypes';

@Component({
  selector: 'app-driver-status',
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-status.html',
  styleUrl: './driver-status.css',
})
export class DriverStatusComponent {
  readonly currentTime = input.required<Date>();
  readonly actualPosition = input.required<string>();
  readonly stationQuery = input.required<string>();
  readonly showSuggestions = input.required<boolean>();
  readonly stationSuggestions = input.required<StopLookupResult[]>();
  readonly isResolvingPosition = input.required<boolean>();
  readonly positionError = input<string | null>(null);
  readonly selectedDate = input.required<string>();
  readonly selectedTime = input.required<string>();

  readonly stationQueryChange = output<string>();
  readonly stationInputFocus = output<void>();
  readonly stationInputBlur = output<void>();
  readonly stationSelected = output<StopLookupResult>();
  readonly ownPositionClicked = output<void>();
  readonly selectedDateChange = output<string>();
  readonly selectedTimeChange = output<string>();

  onStationQueryChange(query: string): void {
    this.stationQueryChange.emit(query);
  }

  onInputFocus(): void {
    this.stationInputFocus.emit();
  }

  onInputBlur(): void {
    this.stationInputBlur.emit();
  }

  selectStation(stop: StopLookupResult): void {
    this.stationSelected.emit(stop);
  }

  onOwnPositionClick(): void {
    this.ownPositionClicked.emit();
  }

  onDateChange(value: string): void {
    this.selectedDateChange.emit(value);
  }

  onTimeChange(value: string): void {
    this.selectedTimeChange.emit(value);
  }
}
