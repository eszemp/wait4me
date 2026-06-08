import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

type HomeInfoPanel = 'about' | 'imprint' | 'privacy';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './home.html',
  styleUrls: ['../../app.css', './home.css'],
})
export class Home {
  protected activeInfoPanel: HomeInfoPanel | null = null;

  openInfoPanel(panel: HomeInfoPanel) {
    this.activeInfoPanel = panel;
  }

  closeInfoPanel() {
    this.activeInfoPanel = null;
  }

  protected get infoPanelTitle(): string {
    switch (this.activeInfoPanel) {
      case 'about':
        return 'About us';
      case 'imprint':
        return 'Imprint';
      case 'privacy':
        return 'Privacy';
      default:
        return '';
    }
  }

  protected get infoPanelBody(): string[] {
    switch (this.activeInfoPanel) {
      case 'about':
        return [
          'Wait4Me is an application that allows passengers to request a delay for their connection, if they are likely to miss it due to a delay. Drivers can accept or decline this request based on additional information about the impact of this delay.',
          'This website is a proof of concept developed by Christian Blaser and Estelle Zemp as part of the Geomatics Master Project at ETH Zurich during the Spring Semester 2026.',
        ];
      case 'imprint':
        return [
          'This website is part of Wait4Me.',
          'Wait4Me was created for academic purposes and is not a commercial service.',
          'Contact: cblase@ethz.ch or eszemp@ethz.ch',
        ];
      case 'privacy':
        return [
          'This application is intended to demonstrate workflow concepts. It does not collect any data, besides the requests that users send. These requests cannot be traced back to a specific user and are exclusively used for demonstration purposes.',
        ];
      default:
        return [];
    }
  }
}
