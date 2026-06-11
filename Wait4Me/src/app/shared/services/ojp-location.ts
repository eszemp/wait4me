import { Injectable, signal, effect } from '@angular/core';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { LocationInformationRequest, SDK } from 'ojp-sdk';
import { OJPBase } from './ojp-base';
import type { LocationSuggestion } from '../types/ojp-types';

@Injectable({
  providedIn: 'root',
})
export class OJPLocation extends OJPBase {
  private readonly sdk = SDK.create(
    this.requestorRef,
    {
      url: this.apiUrl,
      authToken: this.apiKey,
    },
    'en',
  );

  constructor() {
    super();
  }

  getLocationInformation(loc_name: string, maxResults = 8) {
    const request = LocationInformationRequest.initWithLocationName(loc_name, ['stop'], maxResults);

    return from(request.fetchResponse(this.sdk)).pipe(
      map((response) => {
        if (!response.ok) {
          throw response.error;
        }

        return (response.value.placeResult ?? [])
          .map((placeResult) => {
            const stop = placeResult.place?.stopPlace;

            return {
              stopPlaceName: this.readTextValue(stop?.stopPlaceName) ?? '',
              stopPlaceRef: stop?.stopPlaceRef ?? '',
            } satisfies LocationSuggestion;
          })
          .filter((item) => item.stopPlaceName.length > 0 && item.stopPlaceRef.length > 0)
          .slice(0, maxResults);
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
}
