import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OJPTrip } from './ojp-trip';
import { OJPLocation } from './ojp-location';
import { PassengerTrip } from '../types/PassengerTripTypes';
import { W4M_REQUEST_CONFIG } from '../config/w4m-request-config';

@Injectable({ providedIn: 'root' })
export class GeofenceService {
  private tripService = inject(OJPTrip);
  private locationService = inject(OJPLocation);
  private lastKnownPosition: { latitude: number; longitude: number; timestamp: number } | null =
    null;

  /**
   * Check whether the user's current (or recently cached) geolocation lies
   * within the configured geofence buffer around the trip's connection track.
   *
   * If geofencing is disabled via `W4M_REQUEST_CONFIG.geofencingEnabled` this
   * returns `true` immediately. Resolves location names to stop references,
   * fetches the connection track, and measures the closest distance between
   * the user and the track geometry.
   *
   * @param trip passenger trip to check
   * @returns boolean resolving to `true` when the user is within the buffer
   */
  async isUserWithinGeofenceForTrip(trip: PassengerTrip): Promise<boolean> {
    if (!W4M_REQUEST_CONFIG.geofencingEnabled) {
      return true;
    }

    const timedLegs = trip.legs.filter((l) => (l as any).kind === 'timed') as any[];
    const first = timedLegs[0];
    const last = timedLegs[timedLegs.length - 1];
    if (!first || !last) {
      console.warn('[Geofence] missing timed legs for trip', {
        hasFirst: Boolean(first),
        hasLast: Boolean(last),
        tripId: trip.id,
      });
      return false;
    }

    try {
      console.log('[Geofence] check start', { tripId: trip.id });

      const originSuggestions = await firstValueFrom(
        this.locationService.getLocationInformation(first.boardStopName, 1),
      );
      const destSuggestions = await firstValueFrom(
        this.locationService.getLocationInformation(last.alightStopName, 1),
      );

      const originRef = originSuggestions[0]?.stopPlaceRef ?? first.boardStopName;
      const destRef = destSuggestions[0]?.stopPlaceRef ?? last.alightStopName;

      const fc = await firstValueFrom(
        this.tripService.getConnectionTrack(
          originRef,
          destRef,
          trip.scheduledStart,
          (first as any).lineName ?? undefined,
        ),
      );

      const userPos = await this.getUserPosition();
      if (!userPos) return false;

      const buffer = W4M_REQUEST_CONFIG.bufferWidthMeters ?? 50;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const feat of fc.features) {
        if (feat.geometry.type === 'LineString') {
          const coords: number[][] = feat.geometry.coordinates;
          const d = this.minDistancePointToPolylineMeters(
            userPos.latitude,
            userPos.longitude,
            coords,
          );
          closestDistance = Math.min(closestDistance, d);
          if (d <= buffer) {
            console.log('[Geofence] check result', {
              tripId: trip.id,
              inside: true,
              distanceMeters: Math.round(d),
              bufferWidthMeters: buffer,
            });
            return true;
          }
        }
        if (feat.geometry.type === 'Point') {
          const [lon, lat] = feat.geometry.coordinates as [number, number];
          const d = this.haversineDistanceMeters(userPos.latitude, userPos.longitude, lat, lon);
          closestDistance = Math.min(closestDistance, d);
          if (d <= buffer) {
            console.log('[Geofence] check result', {
              tripId: trip.id,
              inside: true,
              distanceMeters: Math.round(d),
              bufferWidthMeters: buffer,
            });
            return true;
          }
        }
      }
      console.log('[Geofence] check result', {
        tripId: trip.id,
        inside: false,
        closestDistanceMeters: Math.round(closestDistance),
        bufferWidthMeters: buffer,
      });
      return false;
    } catch (e) {
      console.log('[Geofence] check result', { tripId: trip.id, inside: false, error: String(e) });
      return false;
    }
  }

  private getUserPosition(): Promise<{ latitude: number; longitude: number } | null> {
    const cachedPosition = this.lastKnownPosition;
    if (cachedPosition && Date.now() - cachedPosition.timestamp < 120000) {
      return Promise.resolve({
        latitude: cachedPosition.latitude,
        longitude: cachedPosition.longitude,
      });
    }

    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) return resolve(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.lastKnownPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: Date.now(),
          };
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (_err) => {
          if (cachedPosition)
            return resolve({
              latitude: cachedPosition.latitude,
              longitude: cachedPosition.longitude,
            });
          resolve(null);
        },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 30000 },
      );
    });
  }

  private toRad(v: number) {
    return (v * Math.PI) / 180;
  }

  private haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private minDistancePointToPolylineMeters(lat: number, lon: number, coords: number[][]) {
    if (coords.length === 0) return Infinity;
    const R = 6371000;
    // Use simple equirectangular projection around the first point for meter approximation
    const refLat = coords[0][1];
    const refLon = coords[0][0];
    const refLatRad = this.toRad(refLat);
    const degToMeterLat = (Math.PI / 180) * R;
    const degToMeterLon = (Math.PI / 180) * R * Math.cos(refLatRad);

    const px = (lon - refLon) * degToMeterLon;
    const py = (lat - refLat) * degToMeterLat;

    let minD = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
      const lon1 = coords[i][0];
      const lat1 = coords[i][1];
      const lon2 = coords[i + 1][0];
      const lat2 = coords[i + 1][1];

      const x1 = (lon1 - refLon) * degToMeterLon;
      const y1 = (lat1 - refLat) * degToMeterLat;
      const x2 = (lon2 - refLon) * degToMeterLon;
      const y2 = (lat2 - refLat) * degToMeterLat;

      const vx = x2 - x1;
      const vy = y2 - y1;
      const wx = px - x1;
      const wy = py - y1;

      const vv = vx * vx + vy * vy;
      const proj = vv === 0 ? 0 : (wx * vx + wy * vy) / vv;
      const t = Math.max(0, Math.min(1, proj));

      const cx = x1 + t * vx;
      const cy = y1 + t * vy;

      const dx = px - cx;
      const dy = py - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minD) minD = d;
    }

    return minD;
  }
}
