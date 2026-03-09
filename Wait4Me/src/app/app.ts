import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouteFormComponent } from './components/route-form/route-form.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, RouteFormComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly destinations: string[] = [
    'Zurich HB',
    'Zurich Oerlikon',
    'Basel SBB',
    'Bern',
    'Luzern',
    'Winterthur',
    'St. Gallen',
    'Lausanne',
    'Geneve',
    'Zug'
  ];

  readonly tripForm = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    date: new FormControl(this.getDefaultDate(), { nonNullable: true }),
    time: new FormControl(this.getDefaultTime(), { nonNullable: true })
  });

  private getDefaultDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getDefaultTime(): string {
    const now = new Date();
    const hours = `${now.getHours()}`.padStart(2, '0');
    const minutes = `${now.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
