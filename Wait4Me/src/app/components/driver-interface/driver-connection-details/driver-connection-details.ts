import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  DepartureLine,
  DepartureStop,
  DriverStopRow,
} from '../../../shared/types/DriverDeparturesTypes';
import { W4MDriverService } from '../../../shared/services/w4m-service-driver';
import { Wait4MeDisplay } from '../w4m-display/w4m-display';
import { Wait4MeEditBar } from '../w4m-edit-bar/w4m-edit-bar';
import { Duration } from '../../../shared/models/duration';
import { OJPStopEvent } from '../../../shared/services/ojp-stop-event';

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
  stopEventService = inject(OJPStopEvent);

  readonly currentTime = signal(new Date());

  departure: DepartureLine | null;
  originName: string;

  /** Loads the selected departure, prepares stop order, and starts refresh timers. */
  constructor() {
    const navigation = this.router.currentNavigation();
    const state = (navigation?.extras.state ?? history.state) as {
      selectedDeparture?: DepartureLine;
      originName?: string;
    };

    this.departure = state.selectedDeparture ?? null;
    console.log('Journey Ref', this.departure?.journeyRef);
    this.originName = state.originName?.trim() || 'Current stop';

    if (this.departure) {
      const sequence = this.stops.map((stop) => stop.id);
      this.w4mService.stopSequence.set(sequence);
      console.log('Initialized stop sequence:', sequence);
    }

    const clockTimer = window.setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    const refreshTimer = window.setInterval(async () => {
      if (this.departure) {
        this.departure = await this.stopEventService.refreshDepartureLine(this.departure);
        console.log('real-time traffic data updated.');
      }
    }, 60000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
    });
  }

  /** Closes edit mode before leaving the details view. */
  ngOnDestroy() {
    this.w4mService.closeEditMode();
  }

  /** Returns the formatted line label for display. */
  get lineLabel(): string {
    const value = this.departure?.line?.trim() || 'n/a';
    return value.toLowerCase().startsWith('line') ? value : `Line ${value}`;
  }

  /** Returns the formatted course label for display. */
  get courseLabel(): string {
    return `Course ${this.departure?.course?.trim() || 'n/a'}`;
  }

  /** Returns the destination label for display. */
  get destinationLabel(): string {
    return this.departure?.direction?.trim() || 'Destination n/a';
  }

  /** Builds the list of stop rows shown in the detail view. */
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

  /** Returns the subset of stops visible in the main summary. */
  get visibleStops(): DriverStopRow[] {
    return this.stops.slice(0, 4);
  }

  /** Navigates back to the driver overview while preserving the selection. */
  backToDriver(): void {
    this.router.navigate(['/driver'], {
      state: { preserveSelection: true },
    });
  }

  /** Closes edit mode when the click happens outside the display widget. */
  disable_edit_mode_when_active(event: Event): void {
    const target = event.target as HTMLElement;

    // check if the click was inside a w4m-display component
    if (target.closest('w4m-display')) {
      return;
    }
    if (this.w4mService.editMode()) {
      this.w4mService.closeEditMode();
      console.log('disabled edit mode');
    }
    return;
  }

  /** Calculates the updated delay for a stop after applying local adjustments. */
  calculate_new_delay(stop: DepartureStop): string {
    if (stop.delay.totalMinutes) {
      return stop.delay
        .plus(
          Duration.initFromTotalSeconds(this.w4mService.additionalDelaysAnySource()[stop.id] * 60),
        )
        .format();
    } else {
      return Duration.initFromTotalSeconds(
        this.w4mService.additionalDelaysAnySource()[stop.id] * 60,
      ).format();
    }
  }

  /** Returns whether the provided delay is greater than zero. */
  has_delay(stop_delay: Duration): Boolean {
    return stop_delay.isBiggerThanZero();
  }
}
