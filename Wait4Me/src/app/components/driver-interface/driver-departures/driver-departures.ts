import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

import { DepartureLine } from '../../../services/ojp-stop-event';

@Component({
  selector: 'app-driver-departures',
  imports: [CommonModule],
  templateUrl: './driver-departures.html',
  styleUrl: './driver-departures.css',
})
export class DriverDeparturesComponent {
  readonly actualPosition = input.required<string>();
  readonly departureLines = input.required<DepartureLine[]>();
  readonly isLoadingDepartures = input.required<boolean>();
  readonly hasSelectedOrigin = input<boolean>(false);
  readonly loadError = input<string | null>(null);
}
