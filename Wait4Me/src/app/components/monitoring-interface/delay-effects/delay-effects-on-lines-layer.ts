import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { LineSearchComponent } from '../line-search/line-search.component';

@Component({
  selector: 'app-delay-effects-on-lines-layer',
  templateUrl: './delay-effects-on-lines-layer.html',
  styleUrls: ['./delay-effects-on-lines-layer.css'],
  standalone: true,
  imports: [LineSearchComponent],
})
/**
 * Hosts the delay-effects map and overlays the line search control.
 */
export class DelayEffectsOnLinesLayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private map: maplibregl.Map | null = null;

  /** Creates a non-rotatable map instance for delay visualization. */
  ngAfterViewInit(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json',
      center: [8.65, 47.02],
      zoom: 8.5,
      minZoom: 5,
      maxZoom: 18,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
    });

    this.map.on('load', () => {
      this.map?.setTerrain(null);
      this.map?.dragRotate.disable();
      this.map?.touchZoomRotate.disableRotation();
    });
  }

  /** Disposes map resources when the component is destroyed. */
  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }
}
