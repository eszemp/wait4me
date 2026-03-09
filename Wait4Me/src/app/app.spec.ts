import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render app header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.top-bar')?.textContent).toContain('Wait4Me');
  });

  it('should bind from input to reactive form', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    const fromInput = compiled.querySelector('#from') as HTMLInputElement;

    fromInput.value = 'Zurich HB';
    fromInput.dispatchEvent(new Event('input'));

    expect(app.tripForm.controls.from.value).toBe('Zurich HB');
  });

  it('should initialize date and time values', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.tripForm.controls.date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(app.tripForm.controls.time.value).toMatch(/^\d{2}:\d{2}$/);
  });

  it('should filter from destinations by query', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.onFromQueryChange('zuri');

    expect(app.showFromSuggestions).toBe(true);
    expect(app.filteredFromDestinations).toContain('Zurich HB');
  });

  it('should set destination when selecting from suggestion', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.selectToDestination('Bern');

    expect(app.tripForm.controls.to.value).toBe('Bern');
    expect(app.showToSuggestions).toBe(false);
  });
});
