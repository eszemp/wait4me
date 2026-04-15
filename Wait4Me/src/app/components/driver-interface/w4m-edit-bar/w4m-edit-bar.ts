import { Component, inject, Input } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { W4MDriverService } from '../../../services/w4m-service-driver';
import { OJPLocation } from '../../../services/ojp-location';
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

}