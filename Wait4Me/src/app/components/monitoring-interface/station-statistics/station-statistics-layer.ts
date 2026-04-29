import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import maplibregl from 'maplibre-gl';
import type * as GeoJSON from 'geojson';

type HistogramFeature = {
  type: 'Feature';
  geometry: GeoJSON.Geometry;
  properties: GeoJSON.GeoJsonProperties;
};

type HistogramFeatureCollection = {
  type: 'FeatureCollection';
  features: HistogramFeature[];
};

@Component({
  selector: 'app-station-statistics-layer',
  templateUrl: './station-statistics-layer.html',
  styleUrls: ['./station-statistics-layer.css'],
  standalone: true,
  imports: [CommonModule],
})
/**
 * Renders station transfer-time histogram points and interactive popups.
 */
export class StationStatisticsLayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private readonly histogramBuckets = ['<1m', '1-3m', '3-5m', '5-10m', '10-20m', '20m+'] as const;
  private readonly binColors = ['#b2182b', '#ef8a62', '#fddbc7', '#d1e5f0', '#67a9cf', '#2166ac'];
  private readonly sourceId = 'station-statistics-source';
  private readonly pointsLayerId = 'station-statistics-points';
  private map: maplibregl.Map | null = null;

  readonly legendItems = this.histogramBuckets.map((bucket, index) => ({
    label: bucket,
    color: this.binColors[index],
  }));

  /** Initializes the map and loads the histogram layer once style data is ready. */
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

  /** Loads station histogram GeoJSON and adds styled point features with popups. */
  private async addLayer(): Promise<void> {
    const map = this.map;
    if (!map) {
      return;
    }

    const response = await fetch('/map-data/stop_histogram_schweiz.geojson');
    if (!response.ok) {
      return;
    }

    const geojson = this.colorizeByMaxBin(await response.json());

    map.addSource(this.sourceId, {
      type: 'geojson',
      data: geojson,
    });

    map.addLayer({
      id: this.pointsLayerId,
      type: 'circle',
      source: this.sourceId,
      paint: {
        'circle-radius': 7,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.8,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    });

    map.on('mouseenter', this.pointsLayerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', this.pointsLayerId, () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', this.pointsLayerId, (event) => {
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

      new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        className: 'station-statistics-popup',
      })
        .setLngLat(coordinates)
        .setHTML(content)
        .addTo(map);
    });
  }

  private toSafeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  /** Adds a precomputed color property based on the dominant wait-time bucket. */
  private colorizeByMaxBin(geojson: unknown): HistogramFeatureCollection {
    const root = geojson as { features?: unknown };
    const features = Array.isArray(root?.features) ? root.features : [];

    return {
      type: 'FeatureCollection',
      features: features.map((feature) => {
        const typedFeature = feature as HistogramFeature;
        const properties = (typedFeature.properties ?? {}) as Record<string, unknown>;
        return {
          ...typedFeature,
          type: 'Feature',
          properties: {
            ...properties,
            color: this.getColorForMaxBin(properties),
          },
        };
      }),
    };
  }

  private getColorForMaxBin(properties: Record<string, unknown>): string {
    let maxBinIndex = 0;
    let maxValue = 0;

    for (let index = 0; index < this.histogramBuckets.length; index++) {
      const bucket = this.histogramBuckets[index];
      const value = this.toSafeNumber(properties[bucket]);
      if (value > maxValue) {
        maxValue = value;
        maxBinIndex = index;
      }
    }

    return this.binColors[maxBinIndex];
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
