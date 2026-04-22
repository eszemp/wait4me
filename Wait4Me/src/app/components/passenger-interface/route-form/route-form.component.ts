import { Component, input, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DestinationAutocompleteComponent } from '../destination-autocomplete/destination-autocomplete.component';
import { OJPTrip } from '../../../shared/services/ojp-trip';

type TripForm = FormGroup<{
  from: FormControl<string>;
  to: FormControl<string>;
  date: FormControl<string>;
  time: FormControl<string>;
}>;

@Component({
  selector: 'app-route-form',
  imports: [ReactiveFormsModule, DestinationAutocompleteComponent],
  templateUrl: './route-form.component.html',
  styleUrl: './route-form.component.css'
})
export class RouteFormComponent {
  tripForm = input.required<TripForm>();

  // inject the trip service to update signals
  private tripService = inject(OJPTrip);

  public onDateTimeChanged() : void {
    const { date, time } = this.tripForm().value;
    if (date) {this.tripService.departureDay.set(date);}
    if (time) {this.tripService.departureTimeOfDay.set(time);}
  }
  
}
