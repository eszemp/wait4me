import { Component, Inject, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
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

  stopName: string | null = null;
  depTime: string | null = null;
  delay: number | null = null;
  selectedLayerId: MonitoringLayerId = 'delay-effects-on-lines';

  constructor(
    @Optional() private dialogRef: MatDialogRef<MonitoringInterface>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // If data exists (Modal mode), assign values. 
    // If not (Router mode), vars remain null.
    if (this.data) {
      this.stopName = this.data.stopName ?? null;
      this.depTime = this.data.depTime ?? null;
      this.delay = this.data.delay ?? null;
    }
  }

  close(): void {
    // Only attempt to close if we are actually in a dialog
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }
  
}
