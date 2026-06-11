import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import maplibregl from 'maplibre-gl';
import { BACKEND_URL } from '../../../shared/config/backend';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { Subscription } from 'rxjs';
import {
  LineSearchComponent,
  type SelectedConnectionPayload,
} from '../line-search/line-search.component';

type StationTransferSeriesEntry = {
  time: string;
  minutes: number;
  timestampMs: number;
  outgoingLineId: string | null;
};

type StationTransferDataset = {
  stopRef: string;
  stopName: string;
  stopNameKey: string;
  coordinates: [number, number] | null;
  transferSeries: StationTransferSeriesEntry[];
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
 *
 * This component renders a MapLibre map showing a selected OJP connection
 * as a track line with station stop points. The start station displays as
 * a square; other stations are circles colored by transfer buffer availability.
 * Transfer buffer data is loaded from a local GeoJSON dataset for stations
 * that match by reference or name.
 */
export class DelayEffectsOnLinesLayerComponent implements AfterViewInit, OnDestroy {
  @Input() initialStopName: string | null = null;
  @Input() initialDepartureTime: string | null = null;
  @Input() delay: number | null = null;
  @Input() currentLineCode: string | null = null;
  @Input() autoSelectFirstDeparture = false;

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  selectedDelayMinutes = 0;
  legendExpanded = false;

  private readonly ojpTrip = inject(OJPTrip);
  private readonly http = inject(HttpClient);
  private readonly destroy$ = new Subject<void>();

  private readonly trackSourceId = 'selected-connection-track-source';
  private readonly trackLayerId = 'selected-connection-track-layer';
  private readonly trackStationsLayerId = 'selected-connection-track-stations-layer';
  private readonly trackStartStationLayerId = 'selected-connection-track-start-station-layer';
  private readonly startStationIconId = 'start-station-square-icon';

  private trackSubscription?: Subscription;

  public no_route = false;

  private map: maplibregl.Map | null = null;
  private readonly stationTransferByRef = new Map<string, StationTransferDataset>();
  private readonly stationTransferByName = new Map<string, StationTransferDataset>();
  private readonly missingStationsCache = new Set<string>();

  private latestTrackGeojson: { type: 'FeatureCollection'; features: unknown[] } = {
    type: 'FeatureCollection',
    features: [],
  };

  constructor(private cdr: ChangeDetectorRef) {}

  /**
   * Create the map instance and initialize layers.
   *
   * The map is created in a non-rotatable configuration optimized for
   * the delay-visualization use-case.
   */
  ngAfterViewInit(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json',
      center: [8.23, 46.8],
      zoom: 7.5,
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
      this.addStartStationIcon();
      this.ensureTrackLayer();
    });

    if (this.delay) {
      this.selectedDelayMinutes = this.delay;
    }
  }

  /**
   * Requests and renders the selected connection track, or clears it on deselection.
   *
   * Retrieves GeoJSON from `OJPTrip.getConnectionTrack(...)` and updates the
   * map source. If `selection` is `null` the map source is cleared.
   */
  onLineSelected(selection: SelectedConnectionPayload | null): void {
    this.trackSubscription?.unsubscribe();

    if (!selection) {
      this.updateTrackSource({ type: 'FeatureCollection', features: [] }, true);
      return;
    }

    this.trackSubscription = this.ojpTrip
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
          this.updateTrackSource({ type: 'FeatureCollection', features: [] }, true);
        },
      });
  }

  /**
   * Updates the simulated delay and recomputes remaining transfer buffers for visible stations.
   *
   * Clamps the slider input to a safe integer range and triggers a refresh of
   * the currently displayed station features so remaining buffers are recalculated.
   */
  onDelaySliderInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const value = Number(target?.value ?? 0);
    this.selectedDelayMinutes = Number.isFinite(value)
      ? Math.min(30, Math.max(0, Math.round(value)))
      : 0;

    if (this.latestTrackGeojson.features.length > 0) {
      this.updateTrackSource(this.latestTrackGeojson);
    }
  }

  /** Toggles the legend expand/collapse state. */
  toggleLegend(): void {
    this.legendExpanded = !this.legendExpanded;
  }

  /**
   * Adds a custom square icon to the map for start station rendering.
   *
   * Creates a 15×15px canvas-drawn square filled with #395148 and registers
   * it as a MapLibre GL image for use in the start station symbol layer.
   */
  private addStartStationIcon(): void {
    const map = this.map;
    if (!map || map.hasImage(this.startStationIconId)) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 15;
    canvas.height = 15;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.fillStyle = '#395148';
    ctx.fillRect(0, 0, 15, 15);

    const imageData = ctx.getImageData(0, 0, 15, 15);
    map.addImage(this.startStationIconId, imageData, { sdf: false });
  }

  /**
   * Ensures the dedicated source/layer pair for the selected connection track exists.
   *
   * Adds a GeoJSON source and layers for:
   * - Track lines (LineString features)
   * - Station circles (Point features excluding board stops)
   * - Start station square (Point features with stopRole='board')
   *
   * Registers cursor and click interactions for station circle features.
   */
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
          'line-color': '#395148',
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
        filter: [
          'all',
          ['==', ['geometry-type'], 'Point'],
          ['!=', ['get', 'stopRole'], 'board'],
        ] as any,
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'hasTransferData'], false],
            '#395148',
            ['==', ['get', 'remainingBufferMinutes'], null],
            '#ffffff',
            ['<', ['get', 'remainingBufferMinutes'], 0],
            '#ff5555',
            ['==', ['get', 'remainingBufferMinutes'], 0],
            '#ffd1d1',
            '#d1ffed',
          ],
          'circle-stroke-color': '#395148',
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

        const hasTransferData = (feature.properties as Record<string, unknown>)['hasTransferData'];
        if (!hasTransferData) {
          return;
        }

        this.showStationPopup(feature);
      });
    }

    if (!map.getLayer(this.trackStartStationLayerId)) {
      map.addLayer({
        id: this.trackStartStationLayerId,
        type: 'symbol',
        source: this.trackSourceId,
        filter: [
          'all',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['get', 'stopRole'], 'board'],
        ] as any,
        layout: {
          'icon-image': this.startStationIconId,
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
    }
  }

  /**
   * Updates the track source data and re-frames the map to the drawn geometry.
   * Enriches received GeoJSON features with transfer data; then adjusts the viewport to fit the geometry.
   */
  private async updateTrackSource(
    geojson: { type: 'FeatureCollection'; features: unknown[] },
    clearing = false,
  ): Promise<void> {
    const map = this.map;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    this.ensureTrackLayer();
    this.latestTrackGeojson = geojson;

    await this.ensureStationDataCached(geojson);

    const source = map.getSource(this.trackSourceId) as maplibregl.GeoJSONSource | undefined;
    const enrichedGeojson = this.enrichStationFeatures(geojson);
    source?.setData(enrichedGeojson as GeoJSON.FeatureCollection);

    this.fitToTrack(enrichedGeojson, clearing);
  }

  /**
   * Scans the incoming connection track for stations, checks the local cache,
   * and queries the backend for any stations it hasn't seen yet.
   */
  private async ensureStationDataCached(geojson: {
    type: 'FeatureCollection';
    features: unknown[];
  }): Promise<void> {
    const fetchPromises: Promise<void>[] = [];

    for (const feature of geojson.features) {
      const typedFeature = feature as any;
      if (typedFeature.geometry?.type !== 'Point' || !typedFeature.properties) {
        continue;
      }

      const stopRef = this.normalizeStopRef(typedFeature.properties['stopRef']);
      const stopName = this.toSafeString(typedFeature.properties['stopName']) ?? '';
      const stopNameKey = this.normalizeStopName(stopName);

      if (!stopRef && !stopNameKey) continue;

      // Skip if already successfully cached
      if (
        (stopRef && this.stationTransferByRef.has(stopRef)) ||
        (stopNameKey && this.stationTransferByName.has(stopNameKey))
      ) {
        continue;
      }

      // Skip if we already queried the DB and it wasn't there
      const cacheKey = stopRef || stopNameKey;
      if (this.missingStationsCache.has(cacheKey)) {
        continue;
      }

      // Add API call to queue
      const params = new HttpParams().set('ref', stopRef).set('name', stopName);

      const requestPromise = firstValueFrom(
        this.http.get<any>(`${BACKEND_URL}/get-stop`, { params }),
      )
        .then((response) => {
          if (response && response.properties) {
            const dataset = this.buildDatasetFromFeature(response);
            if (dataset.stopRef) this.stationTransferByRef.set(dataset.stopRef, dataset);
            if (dataset.stopNameKey) this.stationTransferByName.set(dataset.stopNameKey, dataset);
          }
        })
        .catch(() => {
          // Suppress 404s and cache the miss so we don't spam the backend
          this.missingStationsCache.add(cacheKey);
        });

      fetchPromises.push(requestPromise);
    }

    // Wait for all missing stations to load simultaneously
    if (fetchPromises.length > 0) {
      await Promise.allSettled(fetchPromises);
    }
  }

  /**
   * Parses the single GeoJSON feature returned by the backend into a strongly typed Dataset.
   */
  private buildDatasetFromFeature(feature: any): StationTransferDataset {
    const properties = feature.properties ?? {};
    const stopRef = this.normalizeStopRef(properties['Nummer']);
    const stopName = this.toSafeString(properties['Name']) ?? 'Stop';
    const stopNameKey = this.normalizeStopName(stopName);
    const coordinates = this.parsePointCoordinates(feature.geometry ?? {});

    const transferTimes = Array.isArray(properties['buffer_timeseries'])
      ? properties['buffer_timeseries']
          .map((entry: any) => {
            const rawEntry = entry as {
              time?: unknown;
              buffer?: unknown;
              outgoing_line_id?: unknown;
            };
            const time = this.toSafeString(rawEntry.time);
            const timestampMs = this.parseTimestampMs(time);
            const bufferSeconds = this.toSafeNumber(rawEntry.buffer);
            const outgoingLineId = this.toSafeString(rawEntry.outgoing_line_id);

            if (!time || Number.isNaN(timestampMs)) return null;

            return {
              time,
              minutes: Math.round(bufferSeconds / 60),
              timestampMs,
              outgoingLineId,
            } satisfies StationTransferSeriesEntry;
          })
          .filter(
            (entry: StationTransferSeriesEntry | null): entry is StationTransferSeriesEntry =>
              entry !== null,
          )
      : [];

    return {
      stopRef,
      stopName,
      stopNameKey,
      coordinates,
      transferSeries: transferTimes,
    };
  }

  /**
   * Enriches connection features with station transfer metrics used for styling and popup details.
   *
   * Annotates existing OJP point features with transfer data from the
   * transfer GeoJSON dataset so stations are shown exactly once.
   */
  private enrichStationFeatures(geojson: { type: 'FeatureCollection'; features: unknown[] }): {
    type: 'FeatureCollection';
    features: unknown[];
  } {
    return {
      ...geojson,
      features: geojson.features.map((feature) => {
        const typedFeature = feature as {
          geometry?: { type?: string };
          properties?: Record<string, unknown>;
        };
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
          return {
            ...typedFeature,
            properties: {
              ...typedFeature.properties,
              stopName: typedFeature.properties['stopName'] ?? '',
              transferSeries: null,
              transferTimeMinutes: null,
              transferTimeMatchedAt: null,
              remainingBufferMinutes: null,
              hasTransferData: false,
            },
          };
        }

        const selectedTransfer = this.findTransferForArrival(dataset.transferSeries, arrivalTime);
        const remainingBufferMinutes = selectedTransfer
          ? selectedTransfer.minutes - this.selectedDelayMinutes
          : null;
        const hasTransferData =
          Array.isArray(dataset.transferSeries) && dataset.transferSeries.length > 0;

        return {
          ...typedFeature,
          properties: {
            ...typedFeature.properties,
            stopName: typedFeature.properties['stopName'] ?? dataset.stopName,
            transferSeries: dataset.transferSeries,
            transferTimeMinutes: selectedTransfer?.minutes ?? null,
            transferTimeMatchedAt: selectedTransfer?.time ?? null,
            outgoingLineId: selectedTransfer?.outgoingLineId ?? null,
            remainingBufferMinutes,
            hasTransferData,
          },
        };
      }),
    };
  }

  /**
   * Shows a popup for a station feature.
   *
   * The popup displays arrival time, available transfer buffer, and the
   * remaining buffer after applying the simulated delay.
   */
  private showStationPopup(feature: maplibregl.MapGeoJSONFeature): void {
    const map = this.map;
    if (!map || feature.geometry.type !== 'Point') {
      return;
    }

    const properties = feature.properties as Record<string, unknown>;
    const coordinates = feature.geometry.coordinates as [number, number];
    const stopName = this.escapeHtml(this.toSafeString(properties['stopName']) ?? 'Stop');
    const arrivalTimeIso = this.toSafeString(properties['arrivalTime']) ?? '';
    const arrivalTimeText = this.escapeHtml(this.formatIsoForPopup(arrivalTimeIso));
    const transferMinutesValue = properties['transferTimeMinutes'];
    const transferMinutes =
      transferMinutesValue == null ? null : this.toSafeNumber(transferMinutesValue);
    const outgoingLineId = this.toSafeString(properties['outgoingLineId']) ?? '';
    const remainingBufferValue = properties['remainingBufferMinutes'];
    const remainingBufferMinutes =
      remainingBufferValue == null || Number.isNaN(Number(remainingBufferValue))
        ? null
        : Number(remainingBufferValue);
    const transferTimeText = transferMinutes === null ? 'n/a' : `${transferMinutes} min`;
    const remainingBufferText =
      remainingBufferMinutes === null ? 'n/a' : `${remainingBufferMinutes} min`;
    const outgoingLineText = outgoingLineId ? this.escapeHtml(outgoingLineId) : 'n/a';

    const content = `
      <div class="station-series-popup-content">
        <div class="station-series-title">${stopName}</div>
        <div class="station-series-row">
          <div class="station-series-time">Arrival:</div>
          <div class="station-series-value">${arrivalTimeText || 'n/a'}</div>
        </div>
        <div class="station-series-row">
          <div class="station-series-time">Available transfer buffer time:</div>
          <div class="station-series-value">${transferTimeText}</div>
        </div>
        <div class="station-series-row">
          <div class="station-series-time">Remaining time buffer:</div>
          <div class="station-series-value">${remainingBufferText}</div>
        </div>
        <div class="station-series-row">
          <div class="station-series-time">Next departing line:</div>
          <div class="station-series-value">${outgoingLineText}</div>
        </div>
      </div>
    `;

    new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      className: 'station-series-popup-shell',
    })
      .setLngLat(coordinates)
      .setHTML(content)
      .addTo(map);
  }

  async showMessageNoGeometry(): Promise<void> {
    this.no_route = true;
    this.cdr.detectChanges();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.no_route = false;
    this.cdr.detectChanges();
  }

  /**
   * Fits the map viewport to all valid coordinates of the currently rendered track.
   *
   * Ignores invalid geometries and ensures padding is applied for UI elements.
   */
  private fitToTrack(
    geojson: { type: 'FeatureCollection'; features: unknown[] },
    clearing: Boolean,
  ): void {
    const map = this.map;
    if (!map || geojson.features.length === 0) {
      if (!clearing) {
        this.showMessageNoGeometry();
      }
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    for (const feature of geojson.features as Array<{
      geometry?: { type?: string; coordinates?: number[][] | number[] };
    }>) {
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

  /** Normalize stop reference by extracting digits or returning the original value. */
  private normalizeStopRef(value: unknown): string {
    const raw = this.toSafeString(value)?.trim() ?? '';
    if (!raw) {
      return '';
    }

    const digitsOnly = raw.replace(/\D+/g, '');
    return digitsOnly || raw;
  }

  /** Normalize stop name: lowercase, remove accents, compress whitespace. */
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

  /** Look up transfer dataset for a station by reference or normalized name. */
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

  /** Parse GeoJSON Point geometry into a `[lng, lat]` tuple or `null`. */
  private parsePointCoordinates(geometry: {
    type?: string;
    coordinates?: unknown;
  }): [number, number] | null {
    if (
      geometry.type !== 'Point' ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2
    ) {
      return null;
    }

    const lng = geometry.coordinates[0];
    const lat = geometry.coordinates[1];
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return null;
    }

    return [lng, lat];
  }

  /**
   * Finds a transfer timeseries entry matching the arrival minute.
   * Returns `null` when no matching entry exists.
   */
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

  /** Parse an ISO timestamp string to epoch milliseconds or NaN on failure. */
  private parseTimestampMs(value: string | null): number {
    if (!value) {
      return Number.NaN;
    }

    const timestampMs = Date.parse(value);
    return Number.isFinite(timestampMs) ? timestampMs : Number.NaN;
  }

  /** Round epoch milliseconds down to the minute (ms). */
  private toMinuteMs(timestampMs: number): number {
    return Math.floor(timestampMs / 60000) * 60000;
  }

  /** Format an ISO timestamp for display in the station popup (de-CH). */
  private formatIsoForPopup(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Zurich',
    });
  }

  /** Convert a likely primitive value to string or return `null`. */
  private toSafeString(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }

  /** Parse a numeric-like value to a finite non-negative number; else `0`. */
  private toSafeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  /** Basic HTML escape used for popup content. */
  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  /**
   * Dispose resources when the component is destroyed.
   *
   * Signals observables to complete and removes the MapLibre instance.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.map?.remove();
    this.map = null;
  }
}
