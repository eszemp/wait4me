import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, RouterOutlet, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  constructor(private http: HttpClient) {}

  dummy_request = {
    passenger_id: 'testing-01',
    incoming_service: 'service-a',
    outgoing_service: 'service-b',
    requested_delay: '2' // in minutes
  }
  
  ngOnInit() {
    this.http.post('http://127.0.0.1:5000/create-request', this.dummy_request)
      .subscribe(response => {
        console.log('Script Output:', response);
      });
  }


}