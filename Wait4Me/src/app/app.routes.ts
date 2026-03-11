import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { PassengerInterface } from './components/passenger-interface/passenger-interface';
import { DriverInterface } from './components/driver-interface/driver-interface';
import { MonitoringInterface } from './components/monitoring-interface/monitoring-interface';

// ... import other components

export const routes: Routes = [
  { path: '', component: Home }, // The landing page
  { path: 'passenger', component: PassengerInterface },
  { path: 'driver', component: DriverInterface },
  { path: 'monitoring', component: MonitoringInterface },
];