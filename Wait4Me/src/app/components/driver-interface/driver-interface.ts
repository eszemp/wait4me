import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { DepartureLine, OJPStopEvent, StopLookupResult } from '../../services/ojp-stop-event';

@Component({
  selector: 'app-driver-interface',
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-interface.html',
  styleUrl: './driver-interface.css',
})
export class DriverInterface {
  private readonly destroyRef = inject(DestroyRef);
  private readonly stopEventService = inject(OJPStopEvent);

  readonly currentTime = signal(new Date());
  readonly actualPosition = signal('Locating current position...');
  readonly departureLines = signal<DepartureLine[]>([]);
  readonly stationSuggestions = signal<StopLookupResult[]>([]);
  readonly stationQuery = signal('');
  readonly isLoadingDepartures = signal(false);
  readonly isResolvingPosition = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly positionError = signal<string | null>(null);

  private readonly selectedStopRef = signal<string | null>(null);

  constructor(private router: Router) {

    const navigation = this.router.currentNavigation();
    const state = navigation?.extras.state as { clearStorage: boolean };
    if (state?.clearStorage) {
      sessionStorage.clear();
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
      this.actualPosition.set(persistedName || 'Selected station');
      this.stationQuery.set(persistedName);
      this.refreshDepartures();
    }

    this.fetchCurrentPositionStop();
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

    this.stopEventService.getDepartingLines(stationId).subscribe({
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

    if (query.trim().length < 2) {
      this.stationSuggestions.set([]);
      return;
    }

    this.stopEventService.searchStopsByName(query.trim()).subscribe({
      next: (stops) => {
        this.stationSuggestions.set(stops);
      },
      error: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown API error';
        this.positionError.set(`Could not search stations: ${message}`);
        this.stationSuggestions.set([]);
      },
    });
  }

  selectSuggestedStation(stop: StopLookupResult): void {
    this.persistSelectedStop(stop);
    this.stationSuggestions.set([]);
    this.refreshDepartures();
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

              this.persistSelectedStop(nearestStop);
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
      this.stationSuggestions.set([]);
    }, 120);
  }

  private persistSelectedStop(stop: StopLookupResult): void {
    this.selectedStopRef.set(stop.stopPlaceRef);
    this.actualPosition.set(stop.stopPlaceName);
    this.stationQuery.set(stop.stopPlaceName);
    this.loadError.set(null);

    sessionStorage.setItem('origin_name', stop.stopPlaceName);
    sessionStorage.setItem('origin_id', stop.stopPlaceRef);
  }
}
