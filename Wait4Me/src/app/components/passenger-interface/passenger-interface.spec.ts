import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PassengerInterface } from './passenger-interface';

describe('PassengerInterface', () => {
  let component: PassengerInterface;
  let fixture: ComponentFixture<PassengerInterface>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PassengerInterface],
    }).compileComponents();

    fixture = TestBed.createComponent(PassengerInterface);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(PassengerInterface);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render app header', () => {
    const fixture = TestBed.createComponent(PassengerInterface);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.top-bar')?.textContent).toContain('Wait4Me');
  });

  it('should bind from input to reactive form', () => {
    const fixture = TestBed.createComponent(PassengerInterface);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    const fromInput = compiled.querySelector('#from') as HTMLInputElement;

    fromInput.value = 'Zurich HB';
    fromInput.dispatchEvent(new Event('input'));

    expect(component.tripForm.controls.from.value).toBe('Zurich HB');
  });

  it('should initialize date and time values', () => {
    const fixture = TestBed.createComponent(PassengerInterface);
    const component = fixture.componentInstance;

    expect(component.tripForm.controls.date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(component.tripForm.controls.time.value).toMatch(/^\d{2}:\d{2}$/);
  });
});

