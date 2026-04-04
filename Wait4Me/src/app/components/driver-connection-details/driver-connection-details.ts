import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Duration } from '../../shared/models/duration';
import { DepartureLine, DepartureStop } from '../../shared/types/DriverDeparturesTypes';

type DriverStopRow = {
  id: string;
  timeTimetable: Date;
  timeEstimated: Date;
  delay: Duration;
  label: string;
};

@Component({
  selector: 'app-driver-connection-details',
  imports: [CommonModule],
  templateUrl: './driver-connection-details.html',
  styleUrls: ['../../app.css', './driver-connection-details.css'],
})
export class DriverConnectionDetails {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

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
        timeTimetable: this.departure.departureTimetable,
        timeEstimated: this.departure.departureEstimated,
        delay: this.departure.departureDelay,
        label: this.originName,
      },
      {
        id: 'destination',
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
}
