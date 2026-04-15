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

  private readonly histogramBuckets = ['<1m', '1-3m', '3-5m', '5-10m', '10-20m', '20m+'] as const;

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
        'circle-radius': 7,
        'circle-color': '#0b7285',
        'circle-opacity': 0.8,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    });

    map.on('mouseenter', 'stop-histogram-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'stop-histogram-circles', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'stop-histogram-circles', (event) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') {
        return;
      }

      const coordinates = feature.geometry.coordinates as [number, number];
      const properties = feature.properties as Record<string, unknown>;
      const stopName = this.escapeHtml(String(properties['Name'] ?? 'Stop'));

      const bins = this.histogramBuckets.map((bucket) => ({
        label: bucket,
        value: this.toSafeNumber(properties[bucket]),
      }));

      const maxValue = Math.max(...bins.map((bin) => bin.value), 1);
      const bars = bins
        .map((bin) => {
          const width = (bin.value / maxValue) * 100;
          return `
            <div class="histogram-row">
              <div class="histogram-label">${bin.label}</div>
              <div class="histogram-bar-track">
                <div class="histogram-bar-fill" style="width:${width}%;"></div>
              </div>
              <div class="histogram-value">${bin.value}</div>
            </div>
          `;
        })
        .join('');

      const content = `
        <div class="histogram-popup-content">
          <div class="histogram-title">${stopName}</div>
          ${bars}
        </div>
      `;

      new maplibregl.Popup({ closeButton: true, closeOnClick: true, className: 'stop-histogram-popup' })
        .setLngLat(coordinates)
        .setHTML(content)
        .addTo(map);
    });
  }

  private toSafeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

}

