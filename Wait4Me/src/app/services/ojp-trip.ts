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
  tripResults = signal<any[]>([]);


  constructor(protected http: HttpClient) {
    super();

    // trigger search automatically
    effect(() => {
      const from = this.originId();
      const to = this.destinationId();

      if (from && to) {
        this.getTripInformation(from, to).subscribe(results => {
          this.tripResults.set(results);
        });
        this.originName.set(sessionStorage.getItem("origin_name"));
        this.destinationName.set(sessionStorage.getItem("destination_name"));
      }
    });
  }

  private buildTripRequest(origin_id: string, destination_id: string): string {
    const curTime = new Date().toISOString();
    const departure_time = curTime; //TODO: implement departure time properly
    const noResults = 8;
    const messageID = 'cd'; // TODO: handle message ids properly

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

  getTripInformation(origin_id: string, destination_id: string) {
    const xmlBody = this.buildTripRequest(origin_id, destination_id);
    const parser = new XMLParser({removeNSPrefix: true});
  
    return this.http.post(this.apiUrl, xmlBody, { 
      headers: this.getHeaders(), 
      responseType: 'text'
    }).pipe(
      map(xmlString => {
        const fullObj = parser.parse(xmlString);
        const rawTripResults = fullObj?.OJP?.OJPResponse?.ServiceDelivery?.OJPTripDelivery?.TripResult;
        const tripArray = Array.isArray(rawTripResults) ? rawTripResults : [rawTripResults];
        return tripArray.map(item => item.Trip);
      })
    );
  }

}
