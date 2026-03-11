import { TestBed } from '@angular/core/testing';
import { OJPLocation } from './ojp-location';

describe('OJPLocation', () => {
  let service: OJPLocation;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OJPLocation);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
