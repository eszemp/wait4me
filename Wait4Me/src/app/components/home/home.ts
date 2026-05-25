import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

type HomeInfoPanel = 'about' | 'impressum' | 'privacy';

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
      case 'impressum':
        return 'Impressum';
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
          'Wait4Me is a proof of concept developed by Christian Blaser and Estelle Zemp in the Geomatics Master Project at ETH Zurich in the Spring Semester 2026.',
        ];
      case 'impressum':
        return [
          'This website is part of Wait4Me, a proof of concept developed by Christian Blaser and Estelle Zemp for the Geomatics Master Project at ETH Zurich in the Spring Semester 2026.',
          'Wait4Me was created for academic purposes and is not a commercial service.',
        ];
      case 'privacy':
        return [
          'Wait4Me is a prototype designed for the Geomatics Master Project at ETH Zurich.',
          'The application is intended to demonstrate workflow concepts and does not introduce a dedicated public-facing privacy policy beyond the project scope.',
        ];
      default:
        return [];
    }
  }
}
