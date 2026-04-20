import { Component, EventEmitter, inject, OnDestroy, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OJPStopEvent } from '../../../shared/services/ojp-stop-event';
import type { StopLookupResult, DepartureLine } from '../../../shared/types/DriverDeparturesTypes';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

export type SelectedConnectionPayload = {
  originStopPlaceRef: string;
  destinationStopPlaceRef: string;
  departureTime: Date;
  lineCode: string;
};

@Component({
  selector: 'app-line-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './line-search.component.html',
  styleUrl: './line-search.component.css',
})
/**
 * Provides station lookup and departure-line selection for the monitoring map.
 */
export class LineSearchComponent implements OnDestroy {
  private ojpStopEvent = inject(OJPStopEvent);

  stationQuery = '';
  stationSuggestions = signal<StopLookupResult[]>([]);
  showStationSuggestions = false;
  
  selectedStation = signal<StopLookupResult | null>(null);
  selectedTime = signal('12:00');
  selectedLine = signal<DepartureLine | null>(null);
  
  departingLines = signal<DepartureLine[]>([]);
  showDepartureDropdown = signal(false);
  error = signal<string | null>(null);

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  @Output() lineSelected = new EventEmitter<SelectedConnectionPayload | null>();

  constructor() {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) => {
        if (query.length >= 2) {
          this.searchStations(query);
        } else {
          this.stationSuggestions.set([]);
        }
      });
  }

  /** Starts debounced station lookup for the current input value. */
  onStationQueryChange(query: string): void {
    this.stationQuery = query;
    this.showStationSuggestions = query.length >= 2;
    this.searchSubject.next(query);
  }

  private searchStations(query: string): void {
    this.ojpStopEvent.searchStopsByName(query).subscribe({
      next: (stops) => {
        this.stationSuggestions.set(stops);
      },
      error: () => {
        this.error.set('Error searching stations');
      },
    });
  }

  /** Selects a station and loads departures for the chosen time. */
  selectStation(station: StopLookupResult): void {
    this.selectedStation.set(station);
    this.selectedLine.set(null);
    this.lineSelected.emit(null);
    this.stationQuery = station.stopPlaceName;
    this.showStationSuggestions = false;
    this.error.set(null);
    
    this.fetchDepartures();
  }

  /** Refreshes departures after the time selector changes. */
  onTimeChange(): void {
    if (this.selectedLine()) {
      this.selectedLine.set(null);
      this.lineSelected.emit(null);
    }

    if (this.selectedStation()) {
      this.fetchDepartures();
    }
  }

  private fetchDepartures(): void {
    const station = this.selectedStation();
    if (!station || !this.selectedTime()) {
      return;
    }

    const searchDate = this.parseDateTime(this.selectedTime());

    this.ojpStopEvent.getDepartingLines(station.stopPlaceRef, searchDate).subscribe({
      next: (lines) => {
        this.departingLines.set(lines);
        this.showDepartureDropdown.set(lines.length > 0);
      },
      error: () => {
        this.error.set('Error fetching connections');
      },
    });
  }

  private parseDateTime(time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    // Fixed date for the monitoring use case.
    return new Date(2026, 3, 15, hours, minutes, 0);
  }

  /** Stores the selected departure line and collapses the dropdown. */
  selectLine(line: DepartureLine): void {
    this.selectedLine.set(line);
    this.showDepartureDropdown.set(false);

    const station = this.selectedStation();
    const destinationStopPlaceRef = line.destinationStopPointRef;
    if (!station || !destinationStopPlaceRef) {
      this.lineSelected.emit(null);
      return;
    }

    this.lineSelected.emit({
      originStopPlaceRef: station.stopPlaceRef,
      destinationStopPlaceRef,
      departureTime: line.departureTimetable,
      lineCode: line.line,
    });
  }

  clearSelectedLine(): void {
    this.selectedLine.set(null);
    this.showDepartureDropdown.set(true);
    this.lineSelected.emit(null);
  }

  /** Formats departure times as dd.MM.yyyy HH:mm. */
  formatDepartureTime(time: Date | string | null | undefined): string {
    if (!time) {
      return '';
    }

    const date = time instanceof Date ? time : new Date(time);
    if (Number.isNaN(date.getTime())) {
      return String(time);
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  /** Hides station suggestions after blur, preserving click selection timing. */
  closeStationSuggestions(): void {
    setTimeout(() => {
      this.showStationSuggestions = false;
    }, 120);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
