import { Component, inject, Input } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { W4MDriverService } from '../../../shared/services/w4m-service-driver';
import { OJPLocation } from '../../../shared/services/ojp-location';
import { Wait4MeRequest } from '../../../shared/types/Wait4MeRequest';

@Component({
  selector: 'w4m-edit-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './w4m-edit-bar.html',
  styleUrls: ['./w4m-edit-bar.css', '../../../app.css'],
})
export class Wait4MeEditBar {
  public w4mService = inject(W4MDriverService);

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
}
