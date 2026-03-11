import { Injectable, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { XMLParser } from 'fast-xml-parser';
import { map } from 'rxjs/operators';
import { OJPBase } from './ojp-base';

@Injectable({
  providedIn: 'root',
})

export class OJPLocation extends OJPBase {

    constructor(private http: HttpClient) {
      super()
    }
  
    private buildLocationRequest(loc_name: string): string {
      const curTime = new Date().toISOString();
      const noResults = 8;
      const messageID = 'ab'; //TODO: handle messageIDs properly
  
      return `<?xml version="1.0" encoding="UTF-8"?>
      <OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <OJPRequest>
              <siri:ServiceRequest>
                  <siri:RequestTimestamp>${curTime}</siri:RequestTimestamp>
                  <siri:RequestorRef>${this.requestorRef}</siri:RequestorRef>
                  <siri:ServiceRequestContext><siri:Language>en</siri:Language></siri:ServiceRequestContext>
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
  
      const parser = new XMLParser();
    
      return this.http.post(this.apiUrl, xmlBody, { 
        headers: this.getHeaders(), 
        responseType: 'text' // because it returns XML not JSON
      }).pipe(
        map(xmlString => {
          const fullObj = parser.parse(xmlString);
          return fullObj?.OJP?.OJPResponse?.['siri:ServiceDelivery']?.OJPLocationInformationDelivery.PlaceResult;
        })
      );
    }

}
