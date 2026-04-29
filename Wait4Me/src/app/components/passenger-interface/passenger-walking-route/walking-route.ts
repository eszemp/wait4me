import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import maplibregl from 'maplibre-gl';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Wait4MeButton } from '../wait4me-button/wait4me-button';
import { OJPTrip } from '../../../shared/services/ojp-trip';
import { W4MPassengerService } from '../../../shared/services/w4m-service-passenger';
import { PassengerTrip } from '../../../shared/types/PassengerTripTypes';

@Component({
  selector: 'app-walking-route',
  imports: [CommonModule, Wait4MeButton],
  templateUrl: './walking-route.html',
  styleUrls: ['../../../app.css', '../passenger-interface.css', './walking-route.css'],
})
/**
 * Displays the selected trip's walking transfer on a dedicated passenger map view.
 */
export class WalkingRoute implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  public tripService = inject(OJPTrip);
  public w4mService = inject(W4MPassengerService);
  private map: maplibregl.Map | null = null;
  private readonly destroy$ = new Subject<void>();
  private readonly walkingRouteSourceId = 'walking-route-source';
  private readonly walkingRouteLayerId = 'walking-route-layer';
  private transferLegId: number | null = null;

  constructor(private router: Router) {
    const navigation = this.router.currentNavigation();
    const selectedTrip = navigation?.extras.state?.['selectedTrip'] ?? null;
    const rawTransferLegId = navigation?.extras.state?.['transferLegId'];
    this.transferLegId = typeof rawTransferLegId === 'number' ? rawTransferLegId : null;

    if (selectedTrip) {
      this.tripService.selectedConnectionTrip.set(selectedTrip);
    }

    effect(() => {
      const trip = this.trip;
      if (!trip) {
        return;
      }

      const timedLegs = trip.legs.filter((leg) => leg.kind === 'timed');
      const firstTimedLeg = timedLegs[0];
      const lastTimedLeg = timedLegs[timedLegs.length - 1];

      if (firstTimedLeg) {
        this.tripService.originName.set(firstTimedLeg.boardStopName);
        this.tripService.originId.set(null);
      }
      if (lastTimedLeg) {
        this.tripService.destinationName.set(lastTimedLeg.alightStopName);
        this.tripService.destinationId.set(null);
      }
    });
  }

  get trip(): PassengerTrip | null {
    return this.tripService.selectedConnectionTrip();
  }

  /**
   * Creates the MapLibre instance and loads the walking route after the style is ready.
   */
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
      this.loadWalkingRoute();
    });
  }

  private loadWalkingRoute(): void {
    const map = this.map;
    const trip = this.trip;
    if (!map || !trip || this.transferLegId === null) {
      return;
    }

    this.tripService
      .getTransferWalkingRoute(trip, this.transferLegId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (geojson) => {
          this.updateWalkingRouteSource(geojson);
        },
        error: () => {
          this.updateWalkingRouteSource({ type: 'FeatureCollection', features: [] });
        },
      });
  }

  /**
   * Writes the walking route GeoJSON into the map source and fits the viewport to it.
   */
  private updateWalkingRouteSource(geojson: {
    type: 'FeatureCollection';
    features: unknown[];
  }): void {
    const map = this.map;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    this.ensureWalkingRouteLayer();
    const source = map.getSource(this.walkingRouteSourceId) as maplibregl.GeoJSONSource | undefined;
    source?.setData(geojson as GeoJSON.FeatureCollection);

    const coordinates = geojson.features.flatMap((feature) => {
      const geometry = (feature as { geometry?: { type?: string; coordinates?: unknown } })
        .geometry;
      if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
        return [];
      }
      return geometry.coordinates.filter(
        (coord): coord is [number, number] =>
          Array.isArray(coord) &&
          coord.length >= 2 &&
          Number.isFinite(coord[0]) &&
          Number.isFinite(coord[1]),
      );
    });

    if (coordinates.length > 0) {
      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 40, maxZoom: 17 });
    }
  }

  /**
   * Ensures the dedicated walking-route source and line layer exist on the map.
   */
  private ensureWalkingRouteLayer(): void {
    const map = this.map;
    if (!map) {
      return;
    }

    if (!map.getSource(this.walkingRouteSourceId)) {
      map.addSource(this.walkingRouteSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer(this.walkingRouteLayerId)) {
      map.addLayer({
        id: this.walkingRouteLayerId,
        type: 'line',
        source: this.walkingRouteSourceId,
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.map?.remove();
    this.map = null;
  }

  /**
   * Returns to the passenger connection detail view.
   */
  backToConnection(): void {
    this.router.navigate(['/passenger/connection-details']);
  }
}
