import { Component, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DestinationAutocompleteComponent } from '../destination-autocomplete/destination-autocomplete.component';

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
}
