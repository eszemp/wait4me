import { TestBed } from '@angular/core/testing';
import { OJPTrip } from './ojp-trip';

describe('OJPTrip', () => {
  let service: OJPTrip;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OJPTrip);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
