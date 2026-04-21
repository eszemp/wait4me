import { Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';

import { environment } from '../../../environments/environments';

@Injectable({
  providedIn: 'root',
})

export abstract class OJPBase {
  protected apiUrl = 'https://odpch-api.clients.liip.ch/ojp20-beta';
  protected requestorRef = 'Wait4Me';
  protected apiKey = environment.apiKey;


  protected getHeaders(): HttpHeaders {
    return new HttpHeaders()
      .set('Content-Type', 'application/xml')
      .set('Authorization', `Bearer ${this.apiKey}`);
  }

  protected getOJPRequestXmlWrapper(content: string): string {
    const curTime = new Date().toISOString();
    return `<?xml version="1.0" encoding="UTF-8"?>
    <OJP xmlns="http://www.vdv.de/ojp" ...>
        <OJPRequest>
            <siri:ServiceRequest>
                <siri:RequestTimestamp>${curTime}</siri:RequestTimestamp>
                <siri:RequestorRef>${this.requestorRef}</siri:RequestorRef>
                ${content}
            </siri:ServiceRequest>
        </OJPRequest>
    </OJP>`;
  }
}


