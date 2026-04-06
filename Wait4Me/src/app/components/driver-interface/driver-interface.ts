import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OJPStopEvent } from '../../services/ojp-stop-event';
import { DepartureLine, StopLookupResult } from  '../../shared/types/DriverDeparturesTypes';
import { DriverDeparturesComponent } from './driver-departures/driver-departures';
import { DriverStatusComponent } from './driver-status/driver-status';

@Component({
  selector: 'app-driver-interface',
  imports: [CommonModule, DriverStatusComponent, DriverDeparturesComponent],
  templateUrl: './driver-interface.html',
  styleUrl: './driver-interface.css',
})
export class DriverInterface {
  private static readonly OWN_POSITION_PLACEHOLDER = 'Own Position';

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly stopEventService = inject(OJPStopEvent);

  readonly currentTime = signal(new Date());
  readonly actualPosition = signal(DriverInterface.OWN_POSITION_PLACEHOLDER);
  readonly selectedOriginName = signal('');
  readonly departureLines = signal<DepartureLine[]>([]);
  readonly stationSuggestions = signal<StopLookupResult[]>([]);
  readonly showSuggestions = signal(false);
  readonly stationQuery = signal('');
  readonly isLoadingDepartures = signal(false);
  readonly isResolvingPosition = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly positionError = signal<string | null>(null);
  readonly selectedDate = signal(this.formatDate(new Date()));
  readonly selectedTime = signal(this.formatTime(new Date()));

  private readonly selectedStopRef = signal<string | null>(null);

  constructor() {

    // clear saved values if component is newly loaded
    const state = history.state;
    if (state && state.clearStorage === true) {
      sessionStorage.clear();
      history.replaceState({}, '')
    }

    const timer = window.setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
    });

    const persistedName = sessionStorage.getItem('origin_name')?.trim() ?? '';
    const persistedRef = sessionStorage.getItem('origin_id')?.trim() ?? '';

    if (persistedRef) {
      this.selectedStopRef.set(persistedRef);
      this.selectedOriginName.set(persistedName || 'Selected station');
      this.stationQuery.set(persistedName);
      this.refreshDepartures();
    }
  }

  refreshDepartures(): void {
    const stationId = this.selectedStopRef();

    if (!stationId) {
      this.departureLines.set([]);
      this.loadError.set('Search a station in the passenger view first to load departures.');
      this.isLoadingDepartures.set(false);
      return;
    }

    this.isLoadingDepartures.set(true);
    this.loadError.set(null);

    this.stopEventService.getDepartingLines(stationId, this.selectedDepartureDate()).subscribe({
      next: (lines) => {
        this.departureLines.set(lines);
        this.isLoadingDepartures.set(false);
      },
      error: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown API error';
        this.loadError.set(`Could not load departures: ${message}`);
        this.departureLines.set([]);
        this.isLoadingDepartures.set(false);
      },
    });
  }

  onStationQueryChange(query: string): void {
    this.stationQuery.set(query);
    this.positionError.set(null);
    if (query.trim().length > 0) {
      this.actualPosition.set(DriverInterface.OWN_POSITION_PLACEHOLDER);
    }
    this.showSuggestions.set(query.trim().length >= 2);

    if (query.trim().length < 2) {
      this.stationSuggestions.set([]);
      return;
    }

    this.stopEventService.searchStopsByName(query.trim()).subscribe({
      next: (stops) => {
        this.stationSuggestions.set(stops);
        this.showSuggestions.set(stops.length > 0);
      },
      error: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown API error';
        this.positionError.set(`Could not search stations: ${message}`);
        this.stationSuggestions.set([]);
        this.showSuggestions.set(false);
      },
    });
  }

  onStationInputFocus(): void {
    this.showSuggestions.set(this.stationQuery().trim().length >= 2 && this.stationSuggestions().length > 0);
  }

  selectSuggestedStation(stop: StopLookupResult): void {
    this.persistSearchStop(stop);
    this.stationSuggestions.set([]);
    this.showSuggestions.set(false);
    this.refreshDepartures();
  }

  onOwnPositionClick(): void {
    this.stationQuery.set('');
    this.stationSuggestions.set([]);
    this.showSuggestions.set(false);
    this.fetchCurrentPositionStop();
  }

  onSelectedDateChange(date: string): void {
    this.selectedDate.set(date);
    if (this.selectedStopRef()) {
      this.refreshDepartures();
    }
  }

  onSelectedTimeChange(time: string): void {
    this.selectedTime.set(time);
    if (this.selectedStopRef()) {
      this.refreshDepartures();
    }
  }

  openConnectionDetails(departure: DepartureLine): void {
    this.router.navigate(['/driver/connection-details'], {
      state: {
        selectedDeparture: departure,
        originName: this.selectedOriginName() || this.actualPosition(),
      },
    });
  }

  fetchCurrentPositionStop(): void {
    if (!navigator.geolocation) {
      this.positionError.set('Geolocation is not supported by this browser.');
      return;
    }

    this.isResolvingPosition.set(true);
    this.positionError.set(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.stopEventService
          .findNearestStopByCoordinates(position.coords.latitude, position.coords.longitude)
          .subscribe({
            next: (nearestStop) => {
              if (!nearestStop) {
                this.positionError.set('No nearby station found for your current position.');
                this.isResolvingPosition.set(false);
                return;
              }

              this.persistOwnPositionStop(nearestStop);
              this.refreshDepartures();
              this.isResolvingPosition.set(false);
            },
            error: (error: unknown) => {
              const message = error instanceof Error ? error.message : 'Unknown API error';
              this.positionError.set(`Could not resolve your position: ${message}`);
              this.isResolvingPosition.set(false);
            },
          });
      },
      (error) => {
        this.positionError.set(`Could not access geolocation: ${error.message}`);
        this.isResolvingPosition.set(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  closeSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions.set(false);
    }, 120);
  }

  private selectedDepartureDate(): Date {
    const datePart = this.selectedDate();
    const timePart = this.selectedTime();

    if (!datePart && !timePart) {
      return new Date();
    }

    const [year, month, day] = (datePart || this.formatDate(new Date()))
      .split('-')
      .map((value) => Number.parseInt(value, 10));
    const [hours, minutes] = (timePart || this.formatTime(new Date()))
      .split(':')
      .map((value) => Number.parseInt(value, 10));

    if (
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day) ||
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return new Date();
    }

    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  private persistSearchStop(stop: StopLookupResult): void {
    this.selectedStopRef.set(stop.stopPlaceRef);
    this.selectedOriginName.set(stop.stopPlaceName);
    this.actualPosition.set(DriverInterface.OWN_POSITION_PLACEHOLDER);
    this.stationQuery.set(stop.stopPlaceName);
    this.loadError.set(null);
    this.positionError.set(null);

    sessionStorage.setItem('origin_name', stop.stopPlaceName);
    sessionStorage.setItem('origin_id', stop.stopPlaceRef);
  }

  private persistOwnPositionStop(stop: StopLookupResult): void {
    this.selectedStopRef.set(stop.stopPlaceRef);
    this.selectedOriginName.set(stop.stopPlaceName);
    this.actualPosition.set(stop.stopPlaceName);
    this.stationQuery.set('');
    this.loadError.set(null);

    sessionStorage.setItem('origin_name', stop.stopPlaceName);
    sessionStorage.setItem('origin_id', stop.stopPlaceRef);
  }
}
