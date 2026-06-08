import { Component, inject, Input } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CommonModule, formatDate } from '@angular/common';
import { W4MDriverService } from '../../../shared/services/w4m-service-driver';
import { DelayImpactAnalysis } from '../../delay-impact-analysis/delay-impact-analysis';

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

    const date = this.w4mService.currentDepTime()!;
    const time_string = formatDate(date!, 'HH:mm', 'en-US');
    const delay = this.w4mService.smallestRequestedDelays()[this.w4mService.activeStopRef()!];


    this.dialog.open(DelayImpactAnalysis, {
      width: '90vw',     
      height: 'calc(100dvh - 70px)', 
      maxWidth: '100vw', 
      maxHeight: '100vh', 
      data: {            
        stopName: this.w4mService.activeStopName(),
        depTime: time_string,
        delay: delay,
        autoSelectFirstDeparture: true,
        showCloseButton: true,
      },
      panelClass: 'custom-modal-container'
    });
  }
}
