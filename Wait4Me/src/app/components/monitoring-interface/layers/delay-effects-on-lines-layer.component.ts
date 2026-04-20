import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import maplibregl from 'maplibre-gl';

@Component({
  selector: 'app-delay-effects-on-lines-layer',
  templateUrl: './delay-effects-on-lines-layer.component.html',
  styleUrls: ['./delay-effects-on-lines-layer.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class DelayEffectsOnLinesLayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private readonly delayBuckets = ['0-2m', '2-5m', '5-10m', '10-20m', '20m+'] as const;
  private readonly delayColors = ['#22c55e', '#86efac', '#fbbf24', '#f97316', '#ef4444'];
  private map: maplibregl.Map | null = null;
  loadMessage = 'Showing delay effects on lines.';

  readonly legendItems = this.delayBuckets.map((bucket, index) => ({
    label: bucket,
    color: this.delayColors[index],
  }));

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
      void this.addLayer();
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  private async addLayer(): Promise<void> {
    const map = this.map;
    if (!map) {
      return;
    }

    const response = await fetch('/map-data/line_delay_effects.geojson');
    if (!response.ok) {
      this.loadMessage = 'No line delay dataset is available yet.';
      map.addSource('delay-effects-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
      return;
    }

    const geojson = this.colorizeByDelayImpact(await response.json());

    map.addSource('delay-effects-source', {
      type: 'geojson',
      data: geojson,
    });

    map.addLayer({
      id: 'delay-effects-lines',
      type: 'line',
      source: 'delay-effects-source',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 10, 2.5, 13, 4],
        'line-opacity': 0.9,
      },
    });

    map.on('mouseenter', 'delay-effects-lines', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'delay-effects-lines', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'delay-effects-lines', (event) => {
      const feature = event.features?.[0];
      if (!feature) {
        return;
      }

      const geometryType = feature.geometry.type;
      if (geometryType !== 'LineString' && geometryType !== 'MultiLineString') {
        return;
      }

      const coordinates = this.getPopupAnchor(feature.geometry.coordinates);
      const properties = feature.properties as Record<string, unknown>;
      const lineName = this.escapeHtml(this.resolveLineName(properties));
      const delayMinutes = this.getDelayMinutes(properties);
      const delayText = delayMinutes > 0 ? `${delayMinutes.toFixed(1)} min` : 'No delay value available';

      const content = `
        <div class="delay-popup-content">
          <div class="delay-title">${lineName}</div>
          <div class="delay-value">${delayText}</div>
        </div>
      `;

      new maplibregl.Popup({ closeButton: true, closeOnClick: true, className: 'delay-effects-popup' })
        .setLngLat(coordinates)
        .setHTML(content)
        .addTo(map);
    });

    this.loadMessage = 'Showing delay effects on lines.';
  }

  private colorizeByDelayImpact(geojson: any): any {
    const features = Array.isArray(geojson?.features) ? geojson.features : [];

    return {
      ...geojson,
      features: features.map((feature: any) => {
        const properties = (feature?.properties ?? {}) as Record<string, unknown>;
        const delayMinutes = this.getDelayMinutes(properties);

        return {
          ...feature,
          properties: {
            ...properties,
            delayMinutes,
            color: this.getColorForDelayImpact(delayMinutes),
          },
        };
      }),
    };
  }

  private getDelayMinutes(properties: Record<string, unknown>): number {
    const candidateKeys = ['delayMinutes', 'delay', 'avgDelay', 'averageDelay', 'meanDelay', 'impactMinutes'];

    for (const key of candidateKeys) {
      const value = this.toSafeNumber(properties[key]);
      if (value > 0) {
        return value;
      }
    }

    return 0;
  }

  private getColorForDelayImpact(delayMinutes: number): string {
    if (delayMinutes < 2) {
      return this.delayColors[0];
    }

    if (delayMinutes < 5) {
      return this.delayColors[1];
    }

    if (delayMinutes < 10) {
      return this.delayColors[2];
    }

    if (delayMinutes < 20) {
      return this.delayColors[3];
    }

    return this.delayColors[4];
  }

  private getPopupAnchor(coordinates: unknown): [number, number] {
    if (Array.isArray(coordinates) && coordinates.length > 0) {
      const firstCoordinate = Array.isArray(coordinates[0]) ? coordinates[0] : coordinates;
      if (Array.isArray(firstCoordinate) && firstCoordinate.length >= 2) {
        return [Number(firstCoordinate[0]), Number(firstCoordinate[1])];
      }
    }

    return [8.65, 47.02];
  }

  private resolveLineName(properties: Record<string, unknown>): string {
    const candidateKeys = ['line', 'lineRef', 'name', 'Name', 'routeName'];

    for (const key of candidateKeys) {
      const value = String(properties[key] ?? '').trim();
      if (value.length > 0) {
        return value.toLowerCase().startsWith('line') ? value : `Line ${value}`;
      }
    }

    return 'Delay effects on lines';
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
