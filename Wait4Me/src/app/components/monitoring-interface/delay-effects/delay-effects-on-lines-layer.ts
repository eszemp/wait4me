import { AfterViewInit, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OJPTrip } from '../../../services/ojp-trip';
import { LineSearchComponent, type SelectedConnectionPayload } from '../line-search/line-search.component';

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
      this.ensureTrackLayer();
    });
  }

  /** Requests and renders the selected connection track, or clears it on deselection. */
  onLineSelected(selection: SelectedConnectionPayload | null): void {
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
  }

  /** Updates the track source data and re-frames the map to the drawn geometry. */
  private updateTrackSource(geojson: { type: 'FeatureCollection'; features: unknown[] }): void {
    const map = this.map;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    this.ensureTrackLayer();

    const source = map.getSource(this.trackSourceId) as maplibregl.GeoJSONSource | undefined;
    source?.setData(geojson as GeoJSON.FeatureCollection);

    this.fitToTrack(geojson);
  }

  /** Fits the map viewport to all valid coordinates of the currently rendered track. */
  private fitToTrack(geojson: { type: 'FeatureCollection'; features: unknown[] }): void {
    const map = this.map;
    if (!map || geojson.features.length === 0) {
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    for (const feature of geojson.features as Array<{ geometry?: { type?: string; coordinates?: number[][] } }>) {
      if (feature.geometry?.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) {
        continue;
      }

      for (const coordinate of feature.geometry.coordinates) {
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

  /** Disposes map resources when the component is destroyed. */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.map?.remove();
    this.map = null;
  }
}
