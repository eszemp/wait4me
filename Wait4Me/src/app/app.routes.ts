import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { PassengerInterface } from './components/passenger-interface/passenger-interface';
import { DriverInterface } from './components/driver-interface/driver-interface';
import { DelayImpactAnalysis } from './components/delay-impact-analysis/delay-impact-analysis';
import { ConnectionDetails } from './components/passenger-interface/passenger-connection-details/connection-details';
import { WalkingRoute } from './components/passenger-interface/passenger-walking-route/walking-route';
import { DriverConnectionDetails } from './components/driver-interface/driver-connection-details/driver-connection-details';

export const routes: Routes = [
  { path: '', component: Home }, // The landing page
  { path: 'passenger', component: PassengerInterface },
  { path: 'driver', component: DriverInterface },
  { path: 'driver/connection-details', component: DriverConnectionDetails },
  { path: 'monitoring', component: DelayImpactAnalysis },
  { path: 'passenger/connection-details', component: ConnectionDetails },
  { path: 'passenger/walking-route', component: WalkingRoute },
];
