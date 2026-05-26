import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { SubmissionFormComponent } from './submission-form.component';

function setUpWithRouteId(id: string | null) {
  TestBed.configureTestingModule({
    imports: [SubmissionFormComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(new Map([['id', id]])) },
      },
    ],
  });
}

describe('SubmissionFormComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    setUpWithRouteId('s1');
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushDraft(extra: Partial<Record<string, unknown>> = {}) {
    const req = httpMock.expectOne('/api/submissions/s1');
    req.flush({
      id: 's1',
      vendorId: 'v1',
      status: 'Draft',
      currentStep: 1,
      formDataJson: {},
      ...extra,
    });
  }

  it('renders the Company Info step (step 1 of 7) with a progress bar at first', () => {
    const fixture = TestBed.createComponent(SubmissionFormComponent);
    fixture.detectChanges();
    flushDraft();
    fixture.detectChanges();

    const html: string = fixture.nativeElement.textContent;
    expect(html).toContain('Step 1 of 7');
    expect(html).toContain('Company Info');

    // Progress bar element exists.
    const bar: HTMLElement = fixture.nativeElement.querySelector('[data-testid="progress-bar"]');
    expect(bar).toBeTruthy();

    // Step-1 inputs exist.
    const companyName: HTMLInputElement | null = fixture.nativeElement.querySelector(
      '[data-testid="companyName-input"]',
    );
    const panInput: HTMLInputElement | null = fixture.nativeElement.querySelector(
      '[data-testid="panNumber-input"]',
    );
    expect(companyName).toBeTruthy();
    expect(panInput).toBeTruthy();
  });

  it('Next is disabled while step-1 mandatory fields are empty', () => {
    const fixture = TestBed.createComponent(SubmissionFormComponent);
    fixture.detectChanges();
    flushDraft();
    fixture.detectChanges();

    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="next-btn"]');
    expect(next).toBeTruthy();
    expect(next.disabled).toBe(true);
  });

  it('invalid PAN keeps Next disabled and shows an inline error', () => {
    const fixture = TestBed.createComponent(SubmissionFormComponent);
    fixture.detectChanges();
    flushDraft();
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="companyName-input"]',
    );
    const panInput: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="panNumber-input"]',
    );
    nameInput.value = 'Acme';
    nameInput.dispatchEvent(new Event('input'));
    panInput.value = 'INVALID';
    panInput.dispatchEvent(new Event('input'));
    panInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="next-btn"]');
    expect(next.disabled).toBe(true);

    const err: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="panNumber-error"]',
    );
    expect(err).toBeTruthy();
    expect(err!.textContent).toContain('Invalid PAN format');
  });

  it('valid PAN + companyName enables Next', () => {
    const fixture = TestBed.createComponent(SubmissionFormComponent);
    fixture.detectChanges();
    flushDraft();
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="companyName-input"]',
    );
    const panInput: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="panNumber-input"]',
    );
    nameInput.value = 'Acme';
    nameInput.dispatchEvent(new Event('input'));
    panInput.value = 'ABCDE1234F';
    panInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="next-btn"]');
    expect(next.disabled).toBe(false);
  });
});
