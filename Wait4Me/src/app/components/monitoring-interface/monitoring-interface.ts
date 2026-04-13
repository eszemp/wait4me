import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

@Component({
  selector: 'app-monitoring-interface',
  templateUrl: './monitoring-interface.html',
  styleUrls: ['./monitoring-interface.css'],
})
export class MonitoringInterface implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    const map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json',
      center: [8.65, 47.02],
      zoom: 8.5,
      minZoom: 5,
      maxZoom: 18,
    });

    map.on('load', () => {
      this.addStopHistogramLayer(map);
    });
  }

  private async addStopHistogramLayer(map: maplibregl.Map): Promise<void> {
    const response = await fetch('/map-data/stop_histogram_schwyz.geojson');
    if (!response.ok) {
      console.error('Failed to load stop histogram GeoJSON:', response.statusText);
      return;
    }

    const geojson = await response.json();

    map.addSource('stop_histogram', {
      type: 'geojson',
      data: geojson,
    });

    map.addLayer({
      id: 'stop-histogram-circles',
      type: 'circle',
      source: 'stop_histogram',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', '<1m'],
          0,
          4,
          40,
          10,
          160,
          18,
        ],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', '<1m'],
          0,
          '#2DC4B2',
          40,
          '#3BB3C3',
          80,
          '#669EC4',
          120,
          '#8B88B6',
          160,
          '#A2719B',
        ],
        'circle-opacity': 0.8,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    });
  }

}

