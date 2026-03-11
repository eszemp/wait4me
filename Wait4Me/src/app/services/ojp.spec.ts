import { TestBed } from '@angular/core/testing';

import { OjpService } from './ojp';

describe('Ojp', () => {
  let service: OjpService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OjpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
