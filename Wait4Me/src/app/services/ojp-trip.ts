import { Injectable, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { XMLParser } from 'fast-xml-parser';
import { map } from 'rxjs/operators';
import { OJPBase } from './ojp-base';

@Injectable({
  providedIn: 'root',
})
export class OJPTrip extends OJPBase{

  originId = signal<string | null>(null);
  originName = signal<string | null>(null);
  destinationId = signal<string | null>(null);
  destinationName = signal<string | null>(null);
  departureDay = signal<string | null>(null);
  departureTimeOfDay = signal<string | null>(null);
  tripResults = signal<any[]>([]);


  constructor(protected http: HttpClient) {
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

  private buildTripRequest(origin_id: string, destination_id: string, departure_time: string): string {
    const curTime = new Date().toISOString();
    console.log(departure_time);
    const noResults = 8;

    return `<?xml version="1.0" encoding="UTF-8"?>
      <OJP xmlns="http://www.vdv.de/ojp" version="2.0">
        <OJPRequest>
          <siri:ServiceRequest xmlns:siri="http://www.siri.org.uk/siri">
            <siri:ServiceRequestContext>
              <siri:Language>en</siri:Language>
            </siri:ServiceRequestContext>
            <siri:RequestTimestamp>${curTime}</siri:RequestTimestamp>
            <siri:RequestorRef>${this.requestorRef}</siri:RequestorRef>
            <OJPTripRequest>
              <siri:RequestTimestamp>${curTime}</siri:RequestTimestamp>
              <Origin>
                <PlaceRef>
                  <StopPlaceRef>${origin_id}</StopPlaceRef>
                  <Name><Text>n/a</Text></Name>
                </PlaceRef>
                <DepArrTime>${departure_time}</DepArrTime>
              </Origin>
              <Destination>
                <PlaceRef>
                  <StopPlaceRef>${destination_id}</StopPlaceRef>
                  <Name><Text>n/a</Text></Name>
                </PlaceRef>
              </Destination>
              <Params>
                <NumberOfResults>${noResults}</NumberOfResults>
                <UseRealtimeData>explanatory</UseRealtimeData>
                <IncludeAllRestrictedLines>true</IncludeAllRestrictedLines>
                <IncludeTrackSections>true</IncludeTrackSections>
                <IncludeLegProjection>false</IncludeLegProjection>
                <IncludeIntermediateStops>true</IncludeIntermediateStops>
              </Params>
            </OJPTripRequest>
          </siri:ServiceRequest>
        </OJPRequest>
      </OJP>`
    
      //TODO: change IncludeLegProjection to true, when can handle large data
  }

  getTripInformation(origin_id: string, destination_id: string, day: string, time_of_day: string) {
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

    const departureDate = new Date(year, month, date, hours, minutes);
    const departure_time = departureDate.toISOString();

    const xmlBody = this.buildTripRequest(origin_id, destination_id, departure_time);

    const parser = new XMLParser({
      removeNSPrefix: true,
      isArray: (tagName, jpath, isObject, isArray) => {
        const arrayTags = ['OJP.OJPResponse.ServiceDelivery.OJPTripDelivery.TripResult','Trip.Leg'];
        return arrayTags.some(path => jpath.endsWith(path));
      }
    });

    return this.http.post(this.apiUrl, xmlBody, {
      headers: this.getHeaders(),
      responseType: 'text'
    }).pipe(
      map(xmlString => {
        const fullObj = parser.parse(xmlString);
        const tripResults = fullObj?.OJP?.OJPResponse?.ServiceDelivery?.OJPTripDelivery?.TripResult || [];
        return tripResults.map((item: any) => item.Trip);
      })
    );
  }

}
