import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import maplibregl from 'maplibre-gl';

@Component({
  selector: 'app-monitoring-interface',
  templateUrl: './monitoring-interface.html',
  styleUrls: ['./monitoring-interface.css'],
})
export class MonitoringInterface implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private readonly histogramBuckets = ['<1m', '1-3m', '3-5m', '5-10m', '10-20m', '20m+'] as const;
  private readonly partnerColorMap: Record<string, string> = {
    'A-Welle': '#f59f00',
    Arcobaleno: '#2b8a3e',
    Frimobil: '#1971c2',
    Libero: '#d9480f',
    OSTWIND: '#c2255c',
    Passepartout: '#5f3dc4',
    ZVV: '#1d4ed8',
  };

  ngAfterViewInit(): void {
    const map = new maplibregl.Map({
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

    map.on('load', async () => {
      map.setTerrain(null);
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();

      await this.addTarifverbundLayer(map);
      await this.addStopHistogramLayer(map);
    });
  }

  private async addTarifverbundLayer(map: maplibregl.Map): Promise<void> {
    const response = await fetch('/map-data/tarifverbund_merged_by_partner.geojson');
    if (!response.ok) {
      console.error('Failed to load tarifverbund GeoJSON:', response.statusText);
      return;
    }

    const rawGeojson = await response.json();
    const styledGeojson = this.prepareTarifverbundGeojsonByPartner(rawGeojson);

    map.addSource('tarifverbundkarte', {
      type: 'geojson',
      data: styledGeojson,
    });

    map.addLayer({
      id: 'tarifverbund-fill',
      type: 'fill',
      source: 'tarifverbundkarte',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.16,
      },
    });

    map.addLayer({
      id: 'tarifverbund-outline',
      type: 'line',
      source: 'tarifverbundkarte',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': 0.9,
      },
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

  private prepareTarifverbundGeojsonByPartner(rawGeojson: any): any {
    const features = Array.isArray(rawGeojson?.features) ? rawGeojson.features : [];

    const styledFeatures = features.map((feature: any) => {
      const properties = (feature?.properties ?? {}) as Record<string, unknown>;
      const partner = String(properties['partner'] ?? '').trim();
      const color = this.resolvePartnerColor(partner);

      return {
        ...feature,
        properties: {
          ...properties,
          color,
        },
      };
    });

    return {
      ...rawGeojson,
      features: styledFeatures,
    };
  }

  private resolvePartnerColor(partner: string): string {
    if (!partner) {
      return '#8a8f98';
    }

    return this.partnerColorMap[partner] ?? this.stringToColor(partner);
  }

  private stringToColor(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index++) {
      hash = value.charCodeAt(index) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    return this.hslToHex(hue, 58, 50);
  }

  private hslToHex(h: number, s: number, l: number): string {
    const sat = s / 100;
    const lig = l / 100;
    const c = (1 - Math.abs(2 * lig - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lig - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    const toHex = (channel: number): string => {
      const value = Math.round((channel + m) * 255);
      return value.toString(16).padStart(2, '0');
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

