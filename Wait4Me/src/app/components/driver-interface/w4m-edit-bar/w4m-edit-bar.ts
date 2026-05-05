import { Component, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { W4MDriverService } from '../../../shared/services/w4m-service-driver';
import { OJPLocation } from '../../../shared/services/ojp-location';
import { Wait4MeRequest } from '../../../shared/types/Wait4MeRequest';
import { MonitoringInterface } from '../../monitoring-interface/monitoring-interface';

@Component({
  selector: 'w4m-edit-bar',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './w4m-edit-bar.html',
  styleUrls: ['./w4m-edit-bar.css', '../../../app.css'],
})
export class Wait4MeEditBar {
  public w4mService = inject(W4MDriverService);
  private dialog = inject(MatDialog);

  public number_of_requests(): String {
    const delay_in_edit =
      this.w4mService.smallestRequestedDelays()[this.w4mService.activeStopRef()!];
    if (!delay_in_edit) {
      return '0';
    }
    if (!this.w4mService.activeRequestIds()[delay_in_edit]) {
      return '0';
    }
    return String(this.w4mService.activeRequestIds()[delay_in_edit].length);
  }

  open_delay_impact_analysis(): void {
    console.log("Opening delay impact analysis in overlay");

    this.dialog.open(MonitoringInterface, {
      width: '80vw',     
      height: '80vh', 
      maxWidth: '100vw', 
      maxHeight: '100vw', 
      data: {            
        stopRef: this.w4mService.activeStopRef(),
        depTime: null // TODO get from driver connection details
      },
      panelClass: 'custom-modal-container'
    });
  }
}
