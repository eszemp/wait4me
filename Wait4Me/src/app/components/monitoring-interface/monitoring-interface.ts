import { Component } from '@angular/core';
import { StationStatisticsLayerComponent } from './layers/station-statistics-layer.component';
import { DelayEffectsOnLinesLayerComponent } from './layers/delay-effects-on-lines-layer.component';

type MonitoringLayerId = 'station-statistics' | 'delay-effects-on-lines';

@Component({
  selector: 'app-monitoring-interface',
  templateUrl: './monitoring-interface.html',
  styleUrls: ['./monitoring-interface.css'],
  standalone: true,
  imports: [StationStatisticsLayerComponent, DelayEffectsOnLinesLayerComponent],
})
export class MonitoringInterface {
  readonly layerOptions: Array<{ id: MonitoringLayerId; label: string }> = [
    { id: 'station-statistics', label: 'Station statistics' },
    { id: 'delay-effects-on-lines', label: 'Delay effects on lines' },
  ];

  selectedLayerId: MonitoringLayerId = 'station-statistics';

  onLayerChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as MonitoringLayerId;
    this.selectedLayerId = value;
  }
}

