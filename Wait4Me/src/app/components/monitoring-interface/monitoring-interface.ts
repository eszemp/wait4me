import { Component } from '@angular/core';
import { StationStatisticsLayerComponent } from './station-statistics/station-statistics-layer';
import { DelayEffectsOnLinesLayerComponent } from './delay-effects/delay-effects-on-lines-layer';

type MonitoringLayerId = 'station-statistics' | 'delay-effects-on-lines';

@Component({
  selector: 'app-monitoring-interface',
  templateUrl: './monitoring-interface.html',
  styleUrls: ['./monitoring-interface.css'],
  standalone: true,
  imports: [StationStatisticsLayerComponent, DelayEffectsOnLinesLayerComponent],
})
/**
 * Entry component for monitoring layers with a simple layer switcher.
 */
export class MonitoringInterface {
  readonly layerOptions: Array<{ id: MonitoringLayerId; label: string }> = [
    { id: 'station-statistics', label: 'Station statistics' },
    { id: 'delay-effects-on-lines', label: 'Delay effects on lines' },
  ];

  selectedLayerId: MonitoringLayerId = 'station-statistics';

  /** Applies the selected monitoring layer from the toolbar dropdown. */
  onLayerChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as MonitoringLayerId;
    this.selectedLayerId = value;
  }
}
