import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StationStatisticsLayerComponent } from './station-statistics/station-statistics-layer';
import { DelayEffectsOnLinesLayerComponent } from './delay-effects/delay-effects-on-lines-layer';

type MonitoringLayerId = 'station-statistics' | 'delay-effects-on-lines';

@Component({
  selector: 'app-monitoring-interface',
  templateUrl: './monitoring-interface.html',
  styleUrls: ['./monitoring-interface.css'],
  standalone: true,
  imports: [FormsModule, StationStatisticsLayerComponent, DelayEffectsOnLinesLayerComponent],
})
/**
 * Entry component for monitoring layers with a simple layer switcher.
 */
export class MonitoringInterface {
  readonly layerOptions: Array<{ id: MonitoringLayerId; label: string }> = [
    { id: 'delay-effects-on-lines', label: 'Delay effects on lines' },
    { id: 'station-statistics', label: 'Station statistics' },
  ];

  stopRef: string | null = null;
  depTime: string | Date | null = null;
  selectedLayerId: MonitoringLayerId = 'delay-effects-on-lines';

  constructor(private router: Router) {
    const navigation = this.router.currentNavigation();
    this.stopRef = navigation?.extras.state?.['stopRef'] ?? null;
    this.depTime = navigation?.extras.state?.['depTime'] ?? null;
  }

  
}
