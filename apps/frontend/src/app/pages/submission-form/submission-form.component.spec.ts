import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
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

  it('clicking Next on a valid step issues PUT /api/submissions/:id with the patch', () => {
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

    fixture.nativeElement.querySelector('[data-testid="next-btn"]').click();
    fixture.detectChanges();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url === '/api/submissions/s1');
    expect(put.request.body.currentStep).toBe(2);
    expect(put.request.body.formDataJson.companyInfo).toEqual(
      expect.objectContaining({ companyName: 'Acme', panNumber: 'ABCDE1234F' }),
    );
    put.flush({
      id: 's1',
      vendorId: 'v1',
      status: 'Draft',
      currentStep: 2,
      formDataJson: { companyInfo: { companyName: 'Acme', panNumber: 'ABCDE1234F' } },
    });

    // Indicator advanced to step 2.
    expect(fixture.nativeElement.textContent).toContain('Step 2 of 7');
  });

  it('CTA reads "Next" on early steps', () => {
    const fixture = TestBed.createComponent(SubmissionFormComponent);
    fixture.detectChanges();
    flushDraft();
    fixture.detectChanges();

    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="next-btn"]');
    expect(next.textContent?.trim()).toBe('Next');
  });

  it('CTA reads "Submit" on the Review step', () => {
    const fixture = TestBed.createComponent(SubmissionFormComponent);
    fixture.detectChanges();
    // Resume directly at the review step (index 6, currentStep 7).
    flushDraft({ currentStep: 7 });
    fixture.detectChanges();

    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="next-btn"]');
    expect(next.textContent?.trim()).toBe('Submit');
  });

  it('clicking Submit on Review POSTs /api/submissions/:id/submit and navigates to /vendor on success', () => {
    const fixture = TestBed.createComponent(SubmissionFormComponent);
    fixture.detectChanges();
    flushDraft({ currentStep: 7 });
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.nativeElement.querySelector('[data-testid="next-btn"]').click();
    fixture.detectChanges();

    const post = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/submissions/s1/submit',
    );
    expect(post.request.body).toEqual({});
    post.flush({
      id: 's1',
      vendorId: 'v1',
      status: 'In-Process',
      currentStep: 7,
      formDataJson: {},
    });
    fixture.detectChanges();

    expect(navSpy).toHaveBeenCalledWith('/vendor');
  });

  it('shows inline error and re-enables Submit when the submit request fails', () => {
    const fixture = TestBed.createComponent(SubmissionFormComponent);
    fixture.detectChanges();
    flushDraft({ currentStep: 7 });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="next-btn"]').click();
    fixture.detectChanges();

    const post = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/submissions/s1/submit',
    );
    post.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const err: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="submit-error"]',
    );
    expect(err).toBeTruthy();
    expect(err!.className).toContain('text-red-600');

    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="next-btn"]');
    expect(next.disabled).toBe(false);
  });

  it('hydrates from saved currentStep when resuming a draft', () => {
    const fixture = TestBed.createComponent(SubmissionFormComponent);
    fixture.detectChanges();
    flushDraft({
      currentStep: 4,
      formDataJson: { taxIds: { gstin: '27ABCDE1234F1Z5' } },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Step 4 of 7');
    expect(fixture.nativeElement.textContent).toContain('Tax IDs');
  });
});
