import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { LocationInformationRequest, SDK, StopEventRequest } from 'ojp-sdk';

import { OJPBase } from './ojp-base';

export type DepartureLine = {
  line: string;
  direction: string;
  departureIso: string;
};

export type StopLookupResult = {
  stopPlaceRef: string;
  stopPlaceName: string;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
};

type NearbyStopLookupResult = StopLookupResult & {
  latitude: number;
  longitude: number;
  distanceMeters: number;
};

@Injectable({
  providedIn: 'root',
})
export class OJPStopEvent extends OJPBase {
  private readonly sdk = SDK.create(
    this.requestorRef,
    {
      url: this.apiUrl,
      authToken: this.apiKey,
    },
    'en',
  );

  getDepartingLines(stopPlaceRef: string, maxResults = 10): Observable<DepartureLine[]> {
    const request = StopEventRequest.initWithPlaceRefAndDate(stopPlaceRef, new Date());

    request.payload.params = {
      ...(request.payload.params ?? {}),
      numberOfResults: maxResults,
      stopEventType: 'departure',
    };

    return from(request.fetchResponse(this.sdk)).pipe(
      map((response) => {
        if (!response.ok) {
          throw response.error;
        }

        const rawResults = response.value.stopEventResult ?? [];

        const rows = rawResults
          .map((result) => {
            const service = result.stopEvent?.service;
            const line =
              service?.publicCode ??
              this.readTextValue(service?.publishedServiceName) ??
              service?.lineRef ??
              '';
            const direction = this.readTextValue(service?.destinationText) ?? '';
            const departure =
              result.stopEvent?.thisCall?.callAtStop?.serviceDeparture?.estimatedTime ??
              result.stopEvent?.thisCall?.callAtStop?.serviceDeparture?.timetabledTime ??
              '';

            return {
              line,
              direction,
              departureIso: departure,
            };
          })
          .filter((row) => row.line.trim().length > 0 && row.departureIso.trim().length > 0)
          .sort((a, b) => a.departureIso.localeCompare(b.departureIso));

        const uniqueRows = rows.filter((row, index, allRows) => {
          return (
            allRows.findIndex((candidate) => {
              return (
                candidate.line === row.line &&
                candidate.direction === row.direction &&
                candidate.departureIso === row.departureIso
              );
            }) === index
          );
        });

        return uniqueRows.slice(0, maxResults);
      }),
    );
  }

  searchStopsByName(searchTerm: string, maxResults = 8): Observable<StopLookupResult[]> {
    const request = LocationInformationRequest.initWithLocationName(searchTerm, ['stop'], maxResults);

    return from(request.fetchResponse(this.sdk)).pipe(
      map((response) => {
        if (!response.ok) {
          throw response.error;
        }

        const rows = (response.value.placeResult ?? [])
          .map((placeResult) => {
            const stop = placeResult.place?.stopPlace;
            const stopPlaceRef = stop?.stopPlaceRef ?? '';
            const stopPlaceName = this.readTextValue(stop?.stopPlaceName) ?? '';

            return {
              stopPlaceRef,
              stopPlaceName,
              latitude: placeResult.place?.geoPosition?.latitude ?? null,
              longitude: placeResult.place?.geoPosition?.longitude ?? null,
              distanceMeters: null,
            } satisfies StopLookupResult;
          })
          .filter((item) => item.stopPlaceRef.length > 0 && item.stopPlaceName.length > 0);

        return rows.slice(0, maxResults);
      }),
    );
  }

  findNearestStopByCoordinates(
    latitude: number,
    longitude: number,
    maxResults = 8,
  ): Observable<StopLookupResult | null> {
    const delta = 0.01;
    const bbox: number[] = [
      longitude - delta,
      latitude - delta,
      longitude + delta,
      latitude + delta,
    ];
    const request = LocationInformationRequest.initWithBBOX(bbox, ['stop'], maxResults);

    return from(request.fetchResponse(this.sdk)).pipe(
      map((response) => {
        if (!response.ok) {
          throw response.error;
        }

        const candidates = (response.value.placeResult ?? [])
          .map((placeResult) => {
            const stop = placeResult.place?.stopPlace;
            const stopPlaceRef = stop?.stopPlaceRef ?? '';
            const stopPlaceName = this.readTextValue(stop?.stopPlaceName) ?? '';
            const candidateLat = placeResult.place?.geoPosition?.latitude;
            const candidateLon = placeResult.place?.geoPosition?.longitude;

            if (
              !stopPlaceRef ||
              !stopPlaceName ||
              typeof candidateLat !== 'number' ||
              typeof candidateLon !== 'number'
            ) {
              return null;
            }

            return {
              stopPlaceRef,
              stopPlaceName,
              latitude: candidateLat,
              longitude: candidateLon,
              distanceMeters: this.distanceMeters(latitude, longitude, candidateLat, candidateLon),
            } satisfies NearbyStopLookupResult;
          })
          .filter((candidate): candidate is NearbyStopLookupResult => candidate !== null)
          .sort((a, b) => a.distanceMeters - b.distanceMeters);

        return candidates[0] ?? null;
      }),
    );
  }

  private readTextValue(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object' && value !== null && 'text' in value) {
      const textValue = (value as { text?: unknown }).text;

      if (typeof textValue === 'string') {
        return textValue;
      }

      if (typeof textValue === 'number') {
        return String(textValue);
      }
    }

    return null;
  }

  private distanceMeters(
    sourceLat: number,
    sourceLon: number,
    targetLat: number,
    targetLon: number,
  ): number {
    const toRad = (value: number): number => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const deltaLat = toRad(targetLat - sourceLat);
    const deltaLon = toRad(targetLon - sourceLon);
    const sourceLatRad = toRad(sourceLat);
    const targetLatRad = toRad(targetLat);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2) * Math.cos(sourceLatRad) * Math.cos(targetLatRad);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  }
}