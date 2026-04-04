import { Injectable, signal, effect } from '@angular/core';
import { forkJoin, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SDK, TripRequest } from 'ojp-sdk';
import type {
  InternationalTextSchema,
  LegSchema,
  TimedLegSchema,
  TransferLegSchema,
  TripResultSchema,
} from 'ojp-shared-types';
import type { PassengerTrip, PassengerLeg, PassengerTimedLeg, PassengerTransferLeg } from '../shared/types/PassengerTripTypes';
import { OJPBase } from './ojp-base';
import { Duration } from '../shared/models/duration';

@Injectable({
  providedIn: 'root',
})
export class OJPTrip extends OJPBase{
  private readonly sdk = SDK.create(
    this.requestorRef,
    {
      url: this.apiUrl,
      authToken: this.apiKey,
    },
    'en',
  );

  originId = signal<string | null>(null);
  originName = signal<string | null>(null);
  destinationId = signal<string | null>(null);
  destinationName = signal<string | null>(null);
  departureDay = signal<string | null>(null);
  departureTimeOfDay = signal<string | null>(null);
  tripResults = signal<PassengerTrip[]>([]);


  constructor() {
    super();

    // trigger search automatically
    effect(() => {
      const from = this.originId();
      const to = this.destinationId();

      if (from && to) {
        this.getTripInformation(from, to, this.departureDay() || "", this.departureTimeOfDay() || "").subscribe(results => {
          this.tripResults.set(results);
        });
        this.originName.set(sessionStorage.getItem("origin_name"));
        this.destinationName.set(sessionStorage.getItem("destination_name"));
      }
    });
  }

  reset() {
    this.originId.set(null);
    this.originName.set(null);
    this.destinationId.set(null);
    this.destinationName.set(null);
    this.tripResults.set([]);
  }

  getTripInformation(origin_id: string, destination_id: string, day: string, time_of_day: string) {

    const departureDate = this.parseDepartureDate(day, time_of_day);

    const request = TripRequest.initWithPlaceRefsOrCoords(origin_id, destination_id);

    request.setDepartureDatetime(departureDate);
    request.setNumberOfResults(8);
    request.disableLinkProkection();

    // ensure that OJP shows theoretically possible timetable connections but also includes realtime info (delays)
    (request as any).payload.params.useRealtimeData = "explanatory";

    return from(request.fetchResponse(this.sdk)).pipe(
      map((response) => {
        if (!response.ok) {
          throw response.error;
        }

        return (response.value.tripResult ?? [])
          .map((result) => this.toPassengerTrip(result))
          .filter((trip): trip is PassengerTrip => trip !== null);
      }),
    );
  }


  private toPassengerTrip(result: TripResultSchema): PassengerTrip | null {

    const trip = result.trip;
    if (!trip) {
      return null;
    }

    const legs = (trip.leg ?? [])
      .map((leg, index) => this.toPassengerLeg(leg, index))
      .filter((leg): leg is PassengerLeg => leg !== null);

    let initialWalkTime = Duration.initFromTotalMinutes(0);
    let finalWalkTime = Duration.initFromTotalMinutes(0);

    if (legs.at(0)?.kind=='transfer') {
      initialWalkTime = legs.at(0)?.duration || Duration.initFromTotalMinutes(0);
    }

    if (legs.at(-1)?.kind=='transfer') {
      finalWalkTime = legs.at(-1)?.duration || Duration.initFromTotalMinutes(0);
    }

    // filter out transfers
    const timedLegs = legs.filter((leg): leg is PassengerTimedLeg => leg.kind === 'timed');

    const firstTimedLeg = timedLegs[0];
    const lastTimedLeg = timedLegs[timedLegs.length - 1];

    return {
      id: this.asString(trip.id) || this.asString(result.id),
      startTime: new Date(this.asString(trip.startTime)),
      scheduledStart: initialWalkTime.subtractFromDate(firstTimedLeg?.boardTimeTimetable),
      startDelay: firstTimedLeg.boardDelay,
      endTime: new Date(this.asString(trip.endTime)),
      scheduledEnd: finalWalkTime.addToDate(lastTimedLeg?.alightTimeTimetable),
      endDelay: lastTimedLeg.alightDelay,
      duration: Duration.initWithDurationSchema(trip.duration),
      transfers: typeof trip.transfers === 'number' ? trip.transfers : 0,
      departurePlatform: firstTimedLeg.boardPlatform,
      legs,
    };
  }

  private toPassengerLeg(leg: LegSchema, index: number): PassengerLeg | null {
    const legDuration = Duration.initWithDurationSchema(leg.duration);
    if (leg.timedLeg) {
      return this.toPassengerTimedLeg(leg.timedLeg, leg.id, legDuration, index);
    }

    if (leg.transferLeg) {
      return this.toPassengerTransferLeg(leg.transferLeg, leg.id, legDuration, index);
    }

    return null;
  }

  private toPassengerTimedLeg(
    timedLeg: TimedLegSchema,
    legId: string,
    legDuration: Duration,
    index: number,
  ): PassengerTimedLeg {
    const board = timedLeg.legBoard;
    const alight = timedLeg.legAlight;
    const boardDelay = this.calculateDelay(board?.serviceDeparture?.timetabledTime, board?.serviceDeparture?.estimatedTime);
    const alightDelay = this.calculateDelay(alight?.serviceArrival?.timetabledTime, alight?.serviceArrival?.estimatedTime);

    return {
      kind: 'timed',
      id: this.asString(legId) || `timed-${index}`,
      duration: legDuration,
      boardTimeTimetable: new Date(this.asString(board?.serviceDeparture?.timetabledTime)),
      boardTimeEstimated: new Date(this.asString(board?.serviceDeparture?.estimatedTime)),
      boardDelay: boardDelay,
      alightTimeTimetable: new Date(this.asString(alight?.serviceArrival?.timetabledTime)),
      alightTimeEstimated: new Date(this.asString(alight?.serviceArrival?.estimatedTime)),
      alightDelay: alightDelay,
      boardStopName: this.readTextValue(board?.stopPointName) ?? '',
      destinationText: this.readTextValue(timedLeg.service?.destinationText) ?? '',
      alightStopName: this.readTextValue(alight?.stopPointName) ?? '',
      boardPlatform: this.getQuayText(board?.estimatedQuay) ?? this.getQuayText(board?.plannedQuay),
    };
  }

  private calculateDelay(timetabledTime: unknown, estimatedTime: unknown): Duration {
    // times have format: 2026-03-30T10:11:18Z
    const scheduled = new Date(this.asString(timetabledTime)).getTime();
    const estimated = new Date(this.asString(estimatedTime)).getTime();

    const diffInMs = estimated - scheduled; // in ms
    const delayInMinutes = Math.floor(diffInMs / (1000 * 60));

    return Duration.initFromTotalMinutes(delayInMinutes);
  
  }

  private toPassengerTransferLeg(
    transferLeg: TransferLegSchema,
    legId: string,
    legDuration: Duration,
    index: number,
  ): PassengerTransferLeg {
    return {
      kind: 'transfer',
      id: this.asString(legId) || `transfer-${index}`,
      duration: legDuration,
    };
  }

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

    if (day !== "") {
      const dayParts = day.split('-');
      year = parseInt(dayParts[0], 10);
      month = parseInt(dayParts[1], 10) - 1; // months are 0-based
      date = parseInt(dayParts[2], 10);
    }

    if (time_of_day !== "") {
      const timeParts = time_of_day.split(':');
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
    }

    return new Date(year, month, date, hours, minutes);
  }
}
