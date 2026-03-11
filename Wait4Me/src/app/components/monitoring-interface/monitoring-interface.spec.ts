import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonitoringInterface } from './monitoring-interface';

describe('MonitoringInterface', () => {
  let component: MonitoringInterface;
  let fixture: ComponentFixture<MonitoringInterface>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonitoringInterface],
    }).compileComponents();

    fixture = TestBed.createComponent(MonitoringInterface);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
