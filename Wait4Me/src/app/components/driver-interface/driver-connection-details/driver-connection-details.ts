import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DepartureLine, DepartureStop, DriverStopRow } from '../../../shared/types/DriverDeparturesTypes';
import { W4MDriverService } from '../../../shared/services/w4m-service-driver';
import { Wait4MeDisplay } from '../w4m-display/w4m-display';
import { Wait4MeEditBar } from '../w4m-edit-bar/w4m-edit-bar';
import { Duration } from '../../../shared/models/duration';



@Component({
  selector: 'app-driver-connection-details',
  imports: [CommonModule, Wait4MeDisplay, Wait4MeEditBar],
  templateUrl: './driver-connection-details.html',
  styleUrls: ['../../../app.css', './driver-connection-details.css'],
})
export class DriverConnectionDetails {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  w4mService = inject(W4MDriverService);

  readonly currentTime = signal(new Date());

  readonly departure: DepartureLine | null;
  readonly originName: string;

  constructor() {
    const navigation = this.router.currentNavigation();
    const state = (navigation?.extras.state ?? history.state) as {
      selectedDeparture?: DepartureLine;
      originName?: string;
    };

    this.departure = state.selectedDeparture ?? null;
    console.log("Journey Ref", this.departure?.journeyRef);
    this.originName = state.originName?.trim() || 'Current stop';

    const timer = window.setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
    });
  }

  get lineLabel(): string {
    const value = this.departure?.line?.trim() || 'n/a';
    return value.toLowerCase().startsWith('line') ? value : `Line ${value}`;
  }

  get courseLabel(): string {
    return `Course ${this.departure?.course?.trim() || 'n/a'}`;
  }

  get destinationLabel(): string {
    return this.departure?.direction?.trim() || 'Destination n/a';
  }

  get stops(): DriverStopRow[] {
    if (!this.departure) {
      return [];
    }

    const apiStops = (this.departure.stops ?? [])
      .map((stop: DepartureStop, index: number) => {
        const stopName = stop.name?.trim();
        if (!stopName) {
          return null;
        }

        return {
          id: stop.id || `stop-${index}`,
          name: stopName,
          timeTimetable: stop.timeTimetable,
          timeEstimated: stop.timeEstimated,
          delay: stop.delay,
          label: stopName,
        } satisfies DriverStopRow;
      })
      .filter((stop): stop is DriverStopRow => stop !== null);

      if (apiStops.length > 0) {
      return apiStops;
    }

    return [
      {
        id: 'origin',
        name: '',
        timeTimetable: this.departure.departureTimetable,
        timeEstimated: this.departure.departureEstimated,
        delay: this.departure.departureDelay,
        label: this.originName,
      },
      {
        id: 'destination',
        name: '',
        timeTimetable: this.departure.arrivalTimetable,
        timeEstimated: this.departure.arrivalEstimated,
        delay: this.departure.arrivalDelay,
        label: this.destinationLabel,
      },
    ];
  }

  get visibleStops(): DriverStopRow[] {
    return this.stops.slice(0, 4);
  }

  backToDriver(): void {
    this.router.navigate(['/driver']);
  }

  disable_edit_mode_when_active(): void {
    // TODO: implement correctly
    if (this.w4mService.editMode() && false) {
      this.w4mService.closeEditMode();
      console.log("disabled edit mode");
    }
  }

  calculate_new_delay(stop : DepartureStop): string {
    return stop.delay.plus(Duration.initFromTotalMinutes(this.w4mService.acceptedDelays()[stop.id])).format();
  }
}
