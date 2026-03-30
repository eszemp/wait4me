import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { PassengerInterface } from './components/passenger-interface/passenger-interface';
import { DriverInterface } from './components/driver-interface/driver-interface';
import { MonitoringInterface } from './components/monitoring-interface/monitoring-interface';
import { ConnectionDetails } from './components/connection-details/connection-details'
import { DriverConnectionDetails } from './components/driver-connection-details/driver-connection-details';

export const routes: Routes = [
  { path: '', component: Home }, // The landing page
  { path: 'passenger', component: PassengerInterface },
  { path: 'driver', component: DriverInterface },
  { path: 'driver/connection-details', component: DriverConnectionDetails },
  { path: 'monitoring', component: MonitoringInterface },
  { path: 'passenger/connection-details', component: ConnectionDetails },
];