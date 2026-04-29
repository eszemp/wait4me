import { Injectable, signal, effect, inject } from '@angular/core';
import { from, Observable, firstValueFrom } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SDK, TripRequest, TripRefineRequest } from 'ojp-sdk';
import type {
  InternationalTextSchema,
  LegSchema,
  TimedLegSchema,
  TransferLegSchema,
  TripResultSchema,
} from 'ojp-shared-types';
import type {
  PassengerTrip,
  PassengerLeg,
  PassengerTimedLeg,
  PassengerTransferLeg,
  CriticalTransfer,
} from '../types/PassengerTripTypes';
import { OJPBase } from './ojp-base';
import { OJPLocation } from './ojp-location';
import { Duration } from '../models/duration';

type ConnectionLineFeature = {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    line: string;
    featureType: 'track';
    stationStops: TimedLegStop[];
  };
};

type ConnectionStationFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: number[] };
  properties: {
    line: string;
    featureType: 'station';
    stopRef: string;
    stopName: string;
    stopRole: 'board' | 'intermediate' | 'alight';
    arrivalTime: string;
  };
};

type ConnectionTrackFeature = ConnectionLineFeature | ConnectionStationFeature;

type TimedLegStop = {
  stopRef: string;
  stopName: string;
  stopRole: 'board' | 'intermediate' | 'alight';
  arrivalTime: string;
};

@Injectable({
  providedIn: 'root',
})
/**
 * Service for fetching and transforming OJP trip data into UI-facing models.
 */
export class OJPTrip extends OJPBase {
  private readonly sdk = SDK.create(
    this.requestorRef,
    {
      url: this.apiUrl,
      authToken: this.apiKey,
    },
    'en',
  );

  private locationService = inject(OJPLocation);

  originId = signal<string | null>(null);
  originName = signal<string | null>(null);
  destinationId = signal<string | null>(null);
  destinationName = signal<string | null>(null);
  departureDay = signal<string | null>(null);
  departureTimeOfDay = signal<string | null>(null);
  tripResults = signal<PassengerTrip[]>([]);
  selectedConnectionTrip = signal<PassengerTrip | null>(null);
  isLoadingTrips = signal(false);

  constructor() {
    super();
    // trigger search automatically
    effect(() => {
      if (this.originId() && this.destinationId()) {
        console.log(this.originId());
        console.log(this.destinationId());
        console.log(this.departureDay());
        console.log(this.departureTimeOfDay());
        this.isLoadingTrips.set(true);
        this.getTripInformation(
          this.originId()!,
          this.destinationId()!,
          this.departureDay() || '',
          this.departureTimeOfDay() || '',
        ).subscribe({
          next: (results) => {
            Promise.all(results)
              .then((resolvedResults) => {
                this.tripResults.set(resolvedResults);
                this.isLoadingTrips.set(false);
              })
              .catch(() => {
                this.tripResults.set([]);
                this.isLoadingTrips.set(false);
              });
          },
          error: () => {
            this.tripResults.set([]);
            this.isLoadingTrips.set(false);
          },
        });
      }
    });
  }

  /**
   * Resets all trip search inputs and clears the currently loaded results.
   */
  reset() {
    this.originId.set(null);
    this.originName.set(null);
    this.destinationId.set(null);
    this.destinationName.set(null);
    this.departureDay.set(null);
    this.departureTimeOfDay.set(null);
    this.tripResults.set([]);
    this.selectedConnectionTrip.set(null);
    this.isLoadingTrips.set(false);
  }

  /**
   * Requests trip connections for the configured origin/destination and departure time.
   */
  getTripInformation(origin_id: string, destination_id: string, day: string, time_of_day: string) {
    const departureDate = this.parseDepartureDate(day, time_of_day);

    const request = TripRequest.initWithPlaceRefsOrCoords(origin_id, destination_id);

    request.setDepartureDatetime(departureDate);
    request.setNumberOfResults(8);
    request.disableLinkProkection();

    // ensure that OJP shows theoretically possible timetable connections but also includes realtime info (delays)
    (request as any).payload.params.useRealtimeData = 'explanatory';

    return from(request.fetchResponse(this.sdk)).pipe(
      map((response) => {
        if (!response.ok) {
          throw response.error;
        }

        return (response.value.tripResult ?? [])
          .map((result) => this.toPassengerTrip(result))
          .filter((trip): trip is Promise<PassengerTrip> => trip !== null);
      }),
    );
  }

  public async refineTrip(): Promise<void> {
    const selected = this.selectedConnectionTrip();
    if (!selected || !selected.rawTrip) {
      return;
    }

    this.isLoadingTrips.set(true);

    try {
      const request = TripRefineRequest.initWithTrip(selected.rawTrip);
      const response = await request.fetchResponse(this.sdk);
      if (response.ok && response.value.tripResult?.[0]) {
        const refinedTrip = await this.toPassengerTrip(response.value.tripResult[0]);
        if (refinedTrip) {
          this.selectedConnectionTrip.set(refinedTrip);
        }
      }
    } catch (error) {
      console.error('Trip refinement failed:', error);
    } finally {
      this.isLoadingTrips.set(false);
    }
  }

  /**
   * Fetches track geometry for the best-matching timed leg and returns GeoJSON features.
   */
  getConnectionTrack(
    originStopPlaceRef: string,
    destinationStopPlaceRef: string,
    departureDate: Date,
    selectedLineCode?: string,
  ): Observable<{ type: 'FeatureCollection'; features: ConnectionTrackFeature[] }> {
    const request = TripRequest.initWithPlaceRefsOrCoords(
      originStopPlaceRef,
      destinationStopPlaceRef,
    );

    request.setDepartureDatetime(departureDate);
    request.setNumberOfResults(8);

    if (request.payload.params) {
      request.payload.params.includeTrackSections = true;
      request.payload.params.includeLegProjection = true;
      request.payload.params.useRealtimeData = 'explanatory';
    }

    return from(request.fetchResponse(this.sdk)).pipe(
      switchMap(async (response) => {
        if (!response.ok) {
          throw response.error;
        }

        const targetDepartureTs = departureDate.getTime();
        const normalizedLineCode = (selectedLineCode ?? '').trim().toLowerCase();
        let bestScore = Number.POSITIVE_INFINITY;
        let bestLineCode = '';
        let bestTrackFeatures: ConnectionLineFeature[] = [];
        let bestStops: TimedLegStop[] = [];

        for (const result of response.value.tripResult ?? []) {
          for (const leg of result.trip?.leg ?? []) {
            const timedLeg = leg.timedLeg;
            const trackSections = timedLeg?.legTrack?.trackSection ?? [];
            if (!timedLeg || trackSections.length === 0) {
              continue;
            }

            const legLineCode = this.asString(
              timedLeg.service?.publicCode ??
                this.readTextValue(timedLeg.service?.publishedServiceName),
            ).trim();

            if (normalizedLineCode && legLineCode.toLowerCase() !== normalizedLineCode) {
              continue;
            }

            const departureTs = new Date(
              this.asString(timedLeg.legBoard?.serviceDeparture?.timetabledTime),
            ).getTime();
            const departureDistance = Number.isFinite(departureTs)
              ? Math.abs(departureTs - targetDepartureTs)
              : Number.POSITIVE_INFINITY;

            const trackFeatures = trackSections
              .map((section) => {
                const coordinates = (section.linkProjection?.position ?? [])
                  .map((position) => [position.longitude, position.latitude] as number[])
                  .filter((coordinate) => coordinate.length === 2);

                if (coordinates.length < 2) {
                  return null;
                }

                return {
                  type: 'Feature' as const,
                  geometry: {
                    type: 'LineString' as const,
                    coordinates,
                  },
                  properties: {
                    line: legLineCode,
                    featureType: 'track' as const,
                  },
                };
              })
              .filter((feature): feature is ConnectionLineFeature => feature !== null);

            if (trackFeatures.length === 0) {
              continue;
            }

            if (departureDistance < bestScore) {
              bestScore = departureDistance;
              bestLineCode = legLineCode;
              bestTrackFeatures = trackFeatures;
              bestStops = this.collectTimedLegStops(timedLeg);
            }
          }
        }

        const serializedStops = bestStops.map((stop) => ({
          stopRef: stop.stopRef,
          stopName: stop.stopName,
          stopRole: stop.stopRole,
          arrivalTime: stop.arrivalTime,
        }));

        const trackFeaturesWithStops = bestTrackFeatures.map((feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            stationStops: serializedStops,
          },
        }));

        return {
          type: 'FeatureCollection' as const,
          features: trackFeaturesWithStops,
        };
      }),
    );
  }

  /**
   * Extracts all board/intermediate/alight stops from a timed leg.
   */
  private collectTimedLegStops(timedLeg: TimedLegSchema): TimedLegStop[] {
    const stops: TimedLegStop[] = [];

    const boardRef = this.asString(timedLeg.legBoard?.stopPointRef).trim();
    if (boardRef.length > 0) {
      const boardArrivalTime = this.asString(
        timedLeg.legBoard?.serviceDeparture?.estimatedTime ??
          timedLeg.legBoard?.serviceDeparture?.timetabledTime,
      ).trim();
      stops.push({
        stopRef: boardRef,
        stopName: this.readTextValue(timedLeg.legBoard?.stopPointName) ?? boardRef,
        stopRole: 'board',
        arrivalTime: boardArrivalTime,
      });
    }

    for (const intermediate of timedLeg.legIntermediate ?? []) {
      const stopRef = this.asString(intermediate.stopPointRef).trim();
      if (stopRef.length === 0) {
        continue;
      }

      const intermediateArrivalTime = this.asString(
        intermediate.serviceArrival?.estimatedTime ?? intermediate.serviceArrival?.timetabledTime,
      ).trim();

      stops.push({
        stopRef,
        stopName: this.readTextValue(intermediate.stopPointName) ?? stopRef,
        stopRole: 'intermediate',
        arrivalTime: intermediateArrivalTime,
      });
    }

    const alightRef = this.asString(timedLeg.legAlight?.stopPointRef).trim();
    if (alightRef.length > 0) {
      const alightArrivalTime = this.asString(
        timedLeg.legAlight?.serviceArrival?.estimatedTime ??
          timedLeg.legAlight?.serviceArrival?.timetabledTime,
      ).trim();
      stops.push({
        stopRef: alightRef,
        stopName: this.readTextValue(timedLeg.legAlight?.stopPointName) ?? alightRef,
        stopRole: 'alight',
        arrivalTime: alightArrivalTime,
      });
    }

    return stops;
  }

  /**
   * Maps a raw OJP trip result into the internal passenger trip model.
   */
  private async toPassengerTrip(result: TripResultSchema): Promise<PassengerTrip | null> {
    const trip = result.trip;
    if (!trip) {
      return null;
    }

    const legs = (trip.leg ?? [])
      .map((leg, index) => this.toPassengerLeg(leg, index))
      .filter((leg): leg is PassengerLeg => leg !== null);

    let initialWalkTime = Duration.initFromTotalMinutes(0);
    let finalWalkTime = Duration.initFromTotalMinutes(0);

    if (legs.at(0)?.kind == 'transfer') {
      initialWalkTime = legs.at(0)?.duration || Duration.initFromTotalMinutes(0);
    }

    if (legs.at(-1)?.kind == 'transfer') {
      finalWalkTime = legs.at(-1)?.duration || Duration.initFromTotalMinutes(0);
    }

    // filter out transfers and timed legs
    const timedLegs = legs.filter((leg): leg is PassengerTimedLeg => leg.kind === 'timed');
    const transferLegs = legs.filter((leg): leg is PassengerTransferLeg => leg.kind === 'transfer');

    const firstTimedLeg = timedLegs[0];
    const lastTimedLeg = timedLegs[timedLegs.length - 1];

    const [criticalTransferId, criticalTransfer] = await this.findCriticalTransfer(
      transferLegs,
      timedLegs,
      legs.length,
    );

    return {
      id: this.asString(trip.id) || this.asString(result.id),
      startTime: new Date(this.asString(trip.startTime)),
      scheduledStart: initialWalkTime.subtractFromDate(firstTimedLeg!.boardTimeTimetable),
      startDelay: firstTimedLeg!.boardDelay,
      endTime: new Date(this.asString(trip.endTime)),
      scheduledEnd: finalWalkTime.addToDate(lastTimedLeg!.alightTimeTimetable),
      endDelay: lastTimedLeg!.alightDelay,
      duration: Duration.initWithDurationSchema(trip.duration),
      transfers: typeof trip.transfers === 'number' ? trip.transfers : 0,
      departurePlatform: firstTimedLeg!.boardPlatform,
      legs,
      criticalTransferId: criticalTransferId,
      criticalTransfer: criticalTransfer,
      rawTrip: trip
    };
  }

  /**
   * Converts one OJP leg into either a timed or transfer passenger leg.
   */
  private toPassengerLeg(leg: LegSchema, index: number): PassengerLeg | null {
    const legDuration = Duration.initWithDurationSchema(leg.duration);
    if (leg.timedLeg) {
      return this.toPassengerTimedLeg(leg.timedLeg, Number(leg.id), legDuration, index);
    }

    if (leg.transferLeg) {
      return this.toPassengerTransferLeg(leg.transferLeg, Number(leg.id), legDuration, index);
    }

    return null;
  }

  /**
   * Converts a timed OJP leg into the passenger timed leg model.
   */
  private toPassengerTimedLeg(
    timedLeg: TimedLegSchema,
    legId: number,
    legDuration: Duration,
    index: number,
  ): PassengerTimedLeg {
    const board = timedLeg.legBoard;
    const alight = timedLeg.legAlight;
    const boardDelay = this.calculateDelay(
      board?.serviceDeparture?.timetabledTime,
      board?.serviceDeparture?.estimatedTime,
    );
    const alightDelay = this.calculateDelay(
      alight?.serviceArrival?.timetabledTime,
      alight?.serviceArrival?.estimatedTime,
    );

    return {
      kind: 'timed',
      id: legId,
      duration: legDuration,
      boardTimeTimetable: new Date(this.asString(board?.serviceDeparture?.timetabledTime)),
      boardTimeEstimated: new Date(this.asString(board?.serviceDeparture?.estimatedTime)),
      boardDelay: boardDelay,
      alightTimeTimetable: new Date(this.asString(alight?.serviceArrival?.timetabledTime)),
      alightTimeEstimated: new Date(this.asString(alight?.serviceArrival?.estimatedTime)),
      alightDelay: alightDelay,
      boardStopName: this.readTextValue(board?.stopPointName) ?? '',
      alightStopName: this.readTextValue(alight?.stopPointName) ?? '',
      boardPlatform: this.getQuayText(board?.estimatedQuay) ?? this.getQuayText(board?.plannedQuay),
      destinationText: this.readTextValue(timedLeg.service?.destinationText) ?? '',
      journeyRef: timedLeg.service?.journeyRef ?? '',
      lineName: this.readTextValue(timedLeg.service?.publishedServiceName) ?? ' ',
    };
  }

  /**
   * Converts a transfer OJP leg into the passenger transfer leg model.
   */
  private toPassengerTransferLeg(
    transferLeg: TransferLegSchema,
    legId: number,
    legDuration: Duration,
    index: number,
  ): PassengerTransferLeg {
    return {
      kind: 'transfer',
      id: legId,
      duration: legDuration,
    };
  }

  /**
   * Builds a critical transfer payload used for transfer protection requests.
   */
  private async toCriticalTransfer(
    transfer_leg: PassengerTransferLeg,
    prev_leg: PassengerTimedLeg,
    next_leg: PassengerTimedLeg,
  ): Promise<CriticalTransfer> {
    const arrival = prev_leg.alightTimeEstimated;
    const actual_arrival = transfer_leg.duration.addToDate(arrival);
    const departure = next_leg.boardTimeEstimated;
    // TODO: maybe adjust so its rounded up to the nearest half minute (later)
    const req_delay_min = Math.ceil(
      Math.abs(actual_arrival.getTime() - departure.getTime()) / (1000 * 60),
    );
    const transferStopName = next_leg.boardStopName;
    const suggestions = await firstValueFrom(
      this.locationService.getLocationInformation(transferStopName, 1),
    );
    const transferStopRef = suggestions[0]?.stopPlaceRef ?? '';
    const incomingServiceRef = prev_leg.journeyRef;
    const outgoingServiceRef = next_leg.journeyRef;
    return {
      incomingJourneyRef: incomingServiceRef ?? '',
      outgoingJourneyRef: outgoingServiceRef ?? '',
      transferStopRef: Number(transferStopRef),
      scheduledOutgoingDeparture: departure,
      requestedDelay: Duration.initFromTotalMinutes(req_delay_min),
    };
  }

  /**
   * Calculates the delay between planned and estimated timestamps in minutes.
   */
  private calculateDelay(timetabledTime: unknown, estimatedTime: unknown): Duration {
    // times have format: 2026-03-30T10:11:18Z
    const scheduled = new Date(this.asString(timetabledTime)).getTime();
    const estimated = new Date(this.asString(estimatedTime)).getTime();

    const diffInMs = estimated - scheduled; // in ms
    const delayInMinutes = Math.floor(diffInMs / (1000 * 60));

    return Duration.initFromTotalMinutes(delayInMinutes);
  }

  /**
   * Finds the first critical transfer in a trip and enriches it with transfer details.
   */
  private async findCriticalTransfer(
    transferLegs: PassengerTransferLeg[],
    timedLegs: PassengerTimedLeg[],
    no_of_legs: number,
  ): Promise<[number | null, CriticalTransfer | null]> {
    const id =
      transferLegs.find((transferLeg) =>
        this.transferIsCritical(transferLeg, timedLegs, no_of_legs),
      )?.id ?? null;
    if (id === null) {
      return [id, null];
    }
    const previous_leg = timedLegs.find((leg) => leg.id === id - 1);
    const transfer_leg = transferLegs.find((leg) => leg.id === id);
    const following_leg = timedLegs.find((leg) => leg.id === id + 1);
    if (!previous_leg || !transfer_leg || !following_leg) return [id, null]; // Safety fallback
    const transfer = await this.toCriticalTransfer(transfer_leg, previous_leg, following_leg);
    return [id, transfer];
  }

  /**
   * Checks whether a transfer is impossible with current real-time arrival/departure values.
   */
  private transferIsCritical(
    transferLeg: PassengerTransferLeg,
    timedLegs: PassengerTimedLeg[],
    totalLegs: number,
  ): Boolean {
    // LegIds start at 1 (not 0)
    if (!(transferLeg.id === 1 || transferLeg.id === totalLegs)) {
      const previous_leg = timedLegs.find((leg) => leg.id === transferLeg.id - 1);
      const following_leg = timedLegs.find((leg) => leg.id === transferLeg.id + 1);
      const arrival = previous_leg?.alightTimeEstimated;
      const departure = following_leg?.boardTimeEstimated;
      if (!arrival || !departure) return false; // Safety fallback
      return transferLeg.duration.addToDate(arrival) > departure;
    }
    return false;
  }

  /**
   * Reads quay/platform labels from multilingual text payloads.
   */
  private getQuayText(value: InternationalTextSchema | undefined): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (value && typeof value === 'object') {
      if (typeof value.text === 'string') {
        return 'Stop ' + value.text;
      }
      if (typeof value.text === 'number') {
        return 'Pl. ' + String(value.text);
      }
    }

    return '';
  }

  /**
   * Extracts plain text from OJP international text structures.
   */
  private readTextValue(value: InternationalTextSchema | undefined): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (value && typeof value === 'object') {
      if (typeof value.text === 'string') {
        return value.text;
      }
    }

    return null;
  }

  /**
   * Safely normalizes supported primitive/date values into strings.
   */
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

  /**
   * Builds a local departure date from date and time input values.
   */
  private parseDepartureDate(day: string, time_of_day: string): Date {
    // departure_time requires format:  "2026-03-23T07:49:30.519Z"
    // day has format                   "2026-03-23" (YYYY-MM-DD from date input)
    // time of day has format           "08:59" (HH:MM from time input)
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let date = now.getDate();
    let hours = now.getHours();
    let minutes = now.getMinutes();

    if (day !== '') {
      const dayParts = day.split('-');
      year = parseInt(dayParts[0], 10);
      month = parseInt(dayParts[1], 10) - 1; // months are 0-based
      date = parseInt(dayParts[2], 10);
    }

    if (time_of_day !== '') {
      const timeParts = time_of_day.split(':');
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
    }

    return new Date(year, month, date, hours, minutes);
  }
}
