import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DriverInterface } from './driver-interface';

describe('DriverInterface', () => {
  let component: DriverInterface;
  let fixture: ComponentFixture<DriverInterface>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriverInterface],
    }).compileComponents();

    fixture = TestBed.createComponent(DriverInterface);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
