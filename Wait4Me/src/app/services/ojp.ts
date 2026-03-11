import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { XMLParser } from 'fast-xml-parser';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root',
})

export class OjpService {
  private apiUrl = 'https://api.opentransportdata.swiss/ojp20';
  private requestorRef = 'Wait4Me';
  private apiKey = environment.apiKey;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders()
      .set('Content-Type', 'application/xml')
      .set('Authorization', `Bearer ${this.apiKey}`);
  }

  private buildLocationRequest(loc_name: string): string {
    const curTime = new Date().toISOString();
    const noResults = 8;
    const messageID = 'ab';

    return `<?xml version="1.0" encoding="UTF-8"?>
    <OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <OJPRequest>
            <siri:ServiceRequest>
                <siri:RequestTimestamp>${curTime}</siri:RequestTimestamp>
                <siri:RequestorRef>${this.requestorRef}</siri:RequestorRef>
                <OJPLocationInformationRequest>
                    <siri:RequestTimestamp>${curTime}</siri:RequestTimestamp>
                    <siri:MessageIdentifier>${messageID}</siri:MessageIdentifier>
                    <InitialInput>
                        <Name>${loc_name}</Name>
                    </InitialInput>
                    <Restrictions>
                        <Type>stop</Type>
                        <NumberOfResults>${noResults}</NumberOfResults>
                    </Restrictions>
                </OJPLocationInformationRequest>
            </siri:ServiceRequest>
        </OJPRequest>
    </OJP>`
  }

  getLocationInformation(loc_name: string) {
    const xmlBody = this.buildLocationRequest(loc_name);

    const parser = new XMLParser(); // Initialize the parser
  
    return this.http.post(this.apiUrl, xmlBody, { 
      headers: this.getHeaders(), 
      responseType: 'text' // because it returns XML not JSON
    }).pipe(
      map(xmlString => {
        const fullObj = parser.parse(xmlString);
        // Dig into the object here and return only what you need
        return fullObj?.OJP?.OJPResponse?.['siri:ServiceDelivery']?.OJPLocationInformationDelivery.PlaceResult;
      })
    );
  }
}

