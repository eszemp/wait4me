import { TestBed } from '@angular/core/testing';
import { OJPBase } from './ojp-base';

describe('OJPBase', () => {
  let service: OJPBase;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OJPBase);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
