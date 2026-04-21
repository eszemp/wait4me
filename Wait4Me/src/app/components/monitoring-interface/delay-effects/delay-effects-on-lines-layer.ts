import { AfterViewInit, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { LineSearchComponent, type SelectedConnectionPayload } from '../line-search/line-search.component';

type StationTransferSeriesEntry = {
  time: string;
  minutes: number;
  timestampMs: number;
};

type StationTransferDataset = {
  stopRef: string;
  stopName: string;
  stopNameKey: string;
  coordinates: [number, number] | null;
  transferSeries: StationTransferSeriesEntry[];
};

type TrackStationStop = {
  stopRef: string;
  stopName: string;
  stopRole: 'board' | 'intermediate' | 'alight';
  arrivalTime: string;
};

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

  private readonly ojpTrip = inject(OJPTrip);
  private readonly destroy$ = new Subject<void>();

  private readonly trackSourceId = 'selected-connection-track-source';
  private readonly trackLayerId = 'selected-connection-track-layer';
  private readonly trackStationsLayerId = 'selected-connection-track-stations-layer';
  private readonly stationTransferDatasetUrl = '/map-data/stop_histogram_schwyz.geojson';

  private map: maplibregl.Map | null = null;
  private readonly stationTransferByRef = new Map<string, StationTransferDataset>();
  private readonly stationTransferByName = new Map<string, StationTransferDataset>();
  private stationTransferDatasetPromise: Promise<void> | null = null;
  private latestTrackGeojson: { type: 'FeatureCollection'; features: unknown[] } = {
    type: 'FeatureCollection',
    features: [],
  };

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
      void this.loadStationTransferDataset();
      this.ensureTrackLayer();
    });
  }

  /** Requests and renders the selected connection track, or clears it on deselection. */
  onLineSelected(selection: SelectedConnectionPayload | null): void {
    void this.loadStationTransferDataset();

    if (!selection) {
      this.updateTrackSource({ type: 'FeatureCollection', features: [] });
      return;
    }

    this.ojpTrip
      .getConnectionTrack(
        selection.originStopPlaceRef,
        selection.destinationStopPlaceRef,
        selection.departureTime,
        selection.lineCode,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (geojson) => {
          this.updateTrackSource(geojson);
        },
        error: () => {
          this.updateTrackSource({ type: 'FeatureCollection', features: [] });
        },
      });
  }

  /** Ensures the dedicated source/layer pair for the selected connection track exists. */
  private ensureTrackLayer(): void {
    const map = this.map;
    if (!map) {
      return;
    }

    if (!map.getSource(this.trackSourceId)) {
      map.addSource(this.trackSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer(this.trackLayerId)) {
      map.addLayer({
        id: this.trackLayerId,
        type: 'line',
        source: this.trackSourceId,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#0f6455',
          'line-width': 5,
          'line-opacity': 0.9,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    }

    if (!map.getLayer(this.trackStationsLayerId)) {
      map.addLayer({
        id: this.trackStationsLayerId,
        type: 'circle',
        source: this.trackSourceId,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': '#ffffff',
          'circle-stroke-color': '#0f6455',
          'circle-stroke-width': 2,
          'circle-radius': 5,
        },
      });

      map.on('mouseenter', this.trackStationsLayerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', this.trackStationsLayerId, () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', this.trackStationsLayerId, (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') {
          return;
        }

        this.showStationPopup(feature);
      });
    }
  }

  /** Updates the track source data and re-frames the map to the drawn geometry. */
  private updateTrackSource(geojson: { type: 'FeatureCollection'; features: unknown[] }): void {
    const map = this.map;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    this.ensureTrackLayer();
    this.latestTrackGeojson = geojson;

    const source = map.getSource(this.trackSourceId) as maplibregl.GeoJSONSource | undefined;
    const enrichedGeojson = this.enrichStationFeatures(geojson);
    source?.setData(enrichedGeojson as GeoJSON.FeatureCollection);

    this.fitToTrack(enrichedGeojson);
  }

  private async loadStationTransferDataset(): Promise<void> {
    if (this.stationTransferDatasetPromise) {
      return this.stationTransferDatasetPromise;
    }

    this.stationTransferDatasetPromise = (async () => {
      if (this.stationTransferByRef.size > 0 || this.stationTransferByName.size > 0) {
        return;
      }

      const response = await fetch(this.stationTransferDatasetUrl);
      if (!response.ok) {
        return;
      }

      const geojson = await response.json();
      const features = Array.isArray(geojson?.features) ? geojson.features : [];

      for (const feature of features) {
        const properties = (feature?.properties ?? {}) as Record<string, unknown>;
        const stopRef = this.normalizeStopRef(properties['Nummer']);
        const stopName = this.toSafeString(properties['Name']) ?? 'Stop';
        const stopNameKey = this.normalizeStopName(stopName);
        const geometry = (feature?.geometry ?? {}) as { type?: string; coordinates?: unknown };
        const coordinates = this.parsePointCoordinates(geometry);

        const transferTimes = Array.isArray(properties['buffer_timeseries'])
          ? properties['buffer_timeseries']
              .map((entry) => {
                const rawEntry = entry as { time?: unknown; buffer?: unknown };
                const time = this.toSafeString(rawEntry.time);
                const timestampMs = this.parseTimestampMs(time);
                const bufferSeconds = this.toSafeNumber(rawEntry.buffer);

                if (!time || Number.isNaN(timestampMs)) {
                  return null;
                }

                return {
                  time,
                  minutes: Math.round(bufferSeconds / 60),
                  timestampMs,
                } satisfies StationTransferSeriesEntry;
              })
              .filter((entry): entry is StationTransferSeriesEntry => entry !== null)
          : [];

        const dataset: StationTransferDataset = {
          stopRef,
          stopName,
          stopNameKey,
          coordinates,
          transferSeries: transferTimes,
        };

        if (stopRef) {
          this.stationTransferByRef.set(stopRef, dataset);
        }

        if (stopNameKey) {
          this.stationTransferByName.set(stopNameKey, dataset);
        }
      }

      if (this.latestTrackGeojson.features.length > 0) {
        this.updateTrackSource(this.latestTrackGeojson);
      }
    })();

    return this.stationTransferDatasetPromise;
  }

  private enrichStationFeatures(geojson: { type: 'FeatureCollection'; features: unknown[] }): { type: 'FeatureCollection'; features: unknown[] } {
    const generatedStationFeatures: unknown[] = [];
    const generatedFeatureKeys = new Set<string>();

    for (const feature of geojson.features) {
      const typedFeature = feature as {
        geometry?: { type?: string };
        properties?: Record<string, unknown>;
      };

      if (typedFeature.geometry?.type !== 'LineString' || !typedFeature.properties) {
        continue;
      }

      const stationStops = this.readStationStops(typedFeature.properties['stationStops']);
      const line = this.toSafeString(typedFeature.properties['line']) ?? '';

      for (const stationStop of stationStops) {
        const dataset = this.findDatasetForStation(stationStop.stopRef, stationStop.stopName);
        if (!dataset?.coordinates) {
          continue;
        }

        const selectedTransfer = this.findTransferForArrival(dataset.transferSeries, stationStop.arrivalTime);
        const featureKey = `${stationStop.stopRef}__${stationStop.arrivalTime}`;
        if (generatedFeatureKeys.has(featureKey)) {
          continue;
        }

        generatedFeatureKeys.add(featureKey);
        generatedStationFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: dataset.coordinates,
          },
          properties: {
            line,
            featureType: 'station',
            stopRef: stationStop.stopRef,
            stopName: stationStop.stopName || dataset.stopName,
            stopRole: stationStop.stopRole,
            arrivalTime: stationStop.arrivalTime,
            transferSeries: dataset.transferSeries,
            transferTimeMinutes: selectedTransfer?.minutes ?? null,
            transferTimeMatchedAt: selectedTransfer?.time ?? null,
          },
        });
      }
    }

    return {
      ...geojson,
      features: [
        ...geojson.features.map((feature) => {
        const typedFeature = feature as { geometry?: { type?: string }; properties?: Record<string, unknown> };
        if (typedFeature.geometry?.type !== 'Point' || !typedFeature.properties) {
          return feature;
        }

        const stopRef = this.normalizeStopRef(typedFeature.properties['stopRef']);
        const stopName = this.toSafeString(typedFeature.properties['stopName']) ?? '';
        const arrivalTime = this.toSafeString(typedFeature.properties['arrivalTime']) ?? '';

        if (!stopRef && !stopName) {
          return feature;
        }

        const dataset = this.findDatasetForStation(stopRef, stopName);
        if (!dataset) {
          return feature;
        }

        const selectedTransfer = this.findTransferForArrival(dataset.transferSeries, arrivalTime);

        return {
          ...typedFeature,
          properties: {
            ...typedFeature.properties,
            stopName: typedFeature.properties['stopName'] ?? dataset.stopName,
            transferSeries: dataset.transferSeries,
            transferTimeMinutes: selectedTransfer?.minutes ?? null,
            transferTimeMatchedAt: selectedTransfer?.time ?? null,
          },
        };
      }),
        ...generatedStationFeatures,
      ],
    };
  }

  private showStationPopup(feature: maplibregl.MapGeoJSONFeature): void {
    const map = this.map;
    if (!map || feature.geometry.type !== 'Point') {
      return;
    }

    const properties = feature.properties as Record<string, unknown>;
    const coordinates = feature.geometry.coordinates as [number, number];
    const stopName = this.escapeHtml(this.toSafeString(properties['stopName']) ?? this.toSafeString(properties['Name']) ?? 'Stop');
    const arrivalTimeIso = this.toSafeString(properties['arrivalTime']) ?? '';
    const arrivalTimeText = this.escapeHtml(this.formatIsoForPopup(arrivalTimeIso));
    const transferMinutesValue = properties['transferTimeMinutes'];
    const transferMinutes = transferMinutesValue == null ? null : this.toSafeNumber(transferMinutesValue);
    const transferTimeText = transferMinutes === null ? 'n/a' : `${transferMinutes} min`;

    const content = `
      <div class="station-series-popup">
        <div class="station-series-title" style="font-weight: bold;">${stopName}</div>
        <div class="station-series-list" style="min-width: 260px;">
          <div class="station-series-row">
            <div class="station-series-value">${arrivalTimeText || 'n/a'}</div>
          </div>
          <div class="station-series-row">
            <div class="station-series-time">Available transfer time</div>
            <div class="station-series-value">${transferTimeText}</div>
          </div>
        </div>
      </div>
    `;

    new maplibregl.Popup({ closeButton: true, closeOnClick: true, className: 'station-series-popup-shell' })
      .setLngLat(coordinates)
      .setHTML(content)
      .addTo(map);
  }

  /** Fits the map viewport to all valid coordinates of the currently rendered track. */
  private fitToTrack(geojson: { type: 'FeatureCollection'; features: unknown[] }): void {
    const map = this.map;
    if (!map || geojson.features.length === 0) {
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    for (const feature of geojson.features as Array<{ geometry?: { type?: string; coordinates?: number[][] | number[] } }>) {
      if (!feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
        continue;
      }

      if (feature.geometry.type === 'LineString') {
        for (const coordinate of feature.geometry.coordinates as number[][]) {
          if (!Array.isArray(coordinate) || coordinate.length < 2) {
            continue;
          }

          const [lng, lat] = coordinate;
          if (typeof lng !== 'number' || typeof lat !== 'number') {
            continue;
          }

          bounds.extend([lng, lat]);
          hasPoints = true;
        }
        continue;
      }

      if (feature.geometry.type !== 'Point') {
        continue;
      }

      const [lng, lat] = feature.geometry.coordinates as number[];
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        continue;
      }

      bounds.extend([lng, lat]);
      hasPoints = true;
    }

    if (!hasPoints) {
      return;
    }

    map.fitBounds(bounds, {
      padding: { top: 120, right: 120, bottom: 120, left: 120 },
      duration: 700,
      maxZoom: 15,
    });
  }

  private normalizeStopRef(value: unknown): string {
    const raw = this.toSafeString(value)?.trim() ?? '';
    if (!raw) {
      return '';
    }

    const digitsOnly = raw.replace(/\D+/g, '');
    return digitsOnly || raw;
  }

  private normalizeStopName(value: unknown): string {
    const raw = this.toSafeString(value)?.trim().toLowerCase() ?? '';
    if (!raw) {
      return '';
    }

    return raw
      .replaceAll('ä', 'a')
      .replaceAll('ö', 'o')
      .replaceAll('ü', 'u')
      .replaceAll('é', 'e')
      .replaceAll('è', 'e')
      .replaceAll('ê', 'e')
      .replaceAll('à', 'a')
      .replaceAll('ô', 'o')
      .replaceAll('î', 'i')
      .replaceAll('ç', 'c')
      .replace(/\s+/g, ' ');
  }

  private findDatasetForStation(stopRef: string, stopName: string): StationTransferDataset | null {
    if (stopRef) {
      const byRef = this.stationTransferByRef.get(stopRef);
      if (byRef) {
        return byRef;
      }
    }

    const stopNameKey = this.normalizeStopName(stopName);
    if (!stopNameKey) {
      return null;
    }

    return this.stationTransferByName.get(stopNameKey) ?? null;
  }

  private parsePointCoordinates(geometry: { type?: string; coordinates?: unknown }): [number, number] | null {
    if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
      return null;
    }

    const lng = geometry.coordinates[0];
    const lat = geometry.coordinates[1];
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return null;
    }

    return [lng, lat];
  }

  private readStationStops(value: unknown): TrackStationStop[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        const raw = entry as Record<string, unknown>;
        const stopRef = this.toSafeString(raw['stopRef'])?.trim() ?? '';
        const stopName = this.toSafeString(raw['stopName']) ?? '';
        const rawStopRole = this.toSafeString(raw['stopRole']) ?? 'intermediate';
        const stopRole: TrackStationStop['stopRole'] =
          rawStopRole === 'board' || rawStopRole === 'intermediate' || rawStopRole === 'alight'
            ? rawStopRole
            : 'intermediate';
        const arrivalTime = this.toSafeString(raw['arrivalTime']) ?? '';

        if (!stopRef) {
          return null;
        }

        return {
          stopRef,
          stopName,
          stopRole,
          arrivalTime,
        } satisfies TrackStationStop;
      })
      .filter((stop): stop is TrackStationStop => stop !== null);
  }

  private findTransferForArrival(
    transferSeries: StationTransferSeriesEntry[],
    arrivalTimeIso: string,
  ): StationTransferSeriesEntry | null {
    if (!Array.isArray(transferSeries) || transferSeries.length === 0) {
      return null;
    }

    const arrivalTimeMs = this.parseTimestampMs(arrivalTimeIso);
    if (Number.isNaN(arrivalTimeMs)) {
      return null;
    }

    const arrivalMinuteMs = this.toMinuteMs(arrivalTimeMs);

    for (const entry of transferSeries) {
      if (this.toMinuteMs(entry.timestampMs) === arrivalMinuteMs) {
        return entry;
      }
    }

    return null;
  }

  private parseTimestampMs(value: string | null): number {
    if (!value) {
      return Number.NaN;
    }

    const timestampMs = Date.parse(value);
    return Number.isFinite(timestampMs) ? timestampMs : Number.NaN;
  }

  private toMinuteMs(timestampMs: number): number {
    return Math.floor(timestampMs / 60000) * 60000;
  }

  private formatIsoForPopup(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('de-CH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Zurich',
    });
  }

  private toSafeString(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
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

  /** Disposes map resources when the component is destroyed. */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.map?.remove();
    this.map = null;
  }
}
