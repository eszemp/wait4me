import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { LocationInformationRequest, SDK, StopEventRequest } from 'ojp-sdk';

import { OJPBase } from './ojp-base';

export type DepartureLine = {
  line: string;
  course: string | null;
  direction: string;
  departureIso: string;
  arrivalIso: string | null;
  departurePlatformOrStop: string | null;
  stops: DepartureStop[];
};

export type DepartureStop = {
  id: string;
  name: string;
  timeIso: string | null;
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

  getDepartingLines(
    stopPlaceRef: string,
    departureDate: Date = new Date(),
    maxResults = 10,
  ): Observable<DepartureLine[]> {
    const request = StopEventRequest.initWithPlaceRefAndDate(stopPlaceRef, departureDate);

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
            const callAtStop = result.stopEvent?.thisCall?.callAtStop;
            const onwardCalls = result.stopEvent?.onwardCall ?? [];
            const firstOnwardCall = onwardCalls[0]?.callAtStop;
            const lastOnwardCall = onwardCalls[onwardCalls.length - 1]?.callAtStop;
            const line = this.asString(
              service?.publicCode ??
                this.readTextValue(service?.publishedServiceName) ??
                service?.lineRef,
            );
            const course = this.extractCourseNumber(this.asString(service?.journeyRef));
            const direction = this.asString(this.readTextValue(service?.destinationText));
            const departure = this.asString(
              callAtStop?.serviceDeparture?.estimatedTime ??
                callAtStop?.serviceDeparture?.timetabledTime,
            );
            const arrival = this.asString(
              lastOnwardCall?.serviceArrival?.estimatedTime ??
                lastOnwardCall?.serviceArrival?.timetabledTime ??
                firstOnwardCall?.serviceArrival?.estimatedTime ??
                firstOnwardCall?.serviceArrival?.timetabledTime ??
                callAtStop?.serviceArrival?.estimatedTime ??
                callAtStop?.serviceArrival?.timetabledTime,
            );
            const departurePlatformOrStop = this.asNullableString(
              this.readTextValue(callAtStop?.estimatedQuay) ??
                this.readTextValue(callAtStop?.plannedQuay) ??
                this.readTextValue(callAtStop?.stopPointName),
            );

            const currentStopName = this.asString(this.readTextValue(callAtStop?.stopPointName));
            const currentStopTime = this.asNullableString(
              callAtStop?.serviceDeparture?.estimatedTime ??
                callAtStop?.serviceDeparture?.timetabledTime ??
                callAtStop?.serviceArrival?.estimatedTime ??
                callAtStop?.serviceArrival?.timetabledTime,
            );

            const onwardStops: DepartureStop[] = onwardCalls
              .map((onwardCall, index) => {
                const onwardStop = onwardCall.callAtStop;
                const stopName = this.asString(this.readTextValue(onwardStop?.stopPointName));
                const stopTime = this.asNullableString(
                  onwardStop?.serviceArrival?.estimatedTime ??
                    onwardStop?.serviceArrival?.timetabledTime ??
                    onwardStop?.serviceDeparture?.estimatedTime ??
                    onwardStop?.serviceDeparture?.timetabledTime,
                );

                if (!stopName) {
                  return null;
                }

                return {
                  id: `onward-${index}`,
                  name: stopName,
                  timeIso: stopTime,
                } satisfies DepartureStop;
              })
              .filter((stop): stop is DepartureStop => stop !== null);

            const stops: DepartureStop[] = [
              {
                id: 'origin',
                name: currentStopName || this.asString(this.readTextValue(service?.originText)) || 'Current stop',
                timeIso: currentStopTime,
              },
              ...onwardStops,
            ];

            return {
              line,
              course,
              direction,
              departureIso: departure,
              arrivalIso: this.asNullableString(arrival),
              departurePlatformOrStop,
              stops,
            };
          })
          .filter((row) => row.line.trim().length > 0 && row.departureIso.trim().length > 0)
          .sort((a, b) => a.departureIso.localeCompare(b.departureIso));

        const uniqueRows = rows.filter((row, index, allRows) => {
          return (
            allRows.findIndex((candidate) => {
              return (
                candidate.line === row.line &&
                candidate.course === row.course &&
                candidate.direction === row.direction &&
                candidate.departureIso === row.departureIso &&
                candidate.arrivalIso === row.arrivalIso &&
                candidate.departurePlatformOrStop === row.departurePlatformOrStop
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

  private asString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
      return String(value);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return '';
  }

  private asNullableString(value: unknown): string | null {
    const normalized = this.asString(value).trim();
    return normalized.length > 0 ? normalized : null;
  }

  private extractCourseNumber(journeyRef: string): string | null {
    const normalizedRef = journeyRef.trim();
    if (!normalizedRef) {
      return null;
    }

    const trailingMatch = normalizedRef.match(/(\d{3,}(?:-\d+)?)$/);
    if (trailingMatch) {
      return trailingMatch[1];
    }

    const lastToken = normalizedRef.split(':').pop()?.trim() ?? '';
    return lastToken.length > 0 ? lastToken : null;
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