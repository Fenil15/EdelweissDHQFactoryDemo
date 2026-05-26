import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { CheckerSubmissionDetailComponent } from './checker-submission-detail.component';

function configure(submissionId: string): void {
  TestBed.configureTestingModule({
    imports: [CheckerSubmissionDetailComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ id: submissionId })),
          snapshot: { paramMap: convertToParamMap({ id: submissionId }) },
        },
      },
    ],
  });
}

function flushInitialLoad(httpMock: HttpTestingController, id: string): void {
  // Submission detail.
  const sub = httpMock.expectOne(`/api/submissions/${id}`);
  sub.flush({
    id,
    vendorId: 'v',
    vendorName: 'Acme',
    status: 'In-Process',
    currentStep: 7,
    formDataJson: { companyInfo: { companyName: 'Acme' } },
  });
  // Documents.
  const docs = httpMock.expectOne(`/api/submissions/${id}/documents`);
  docs.flush([]);
}

describe('CheckerSubmissionDetailComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    configure('s1');
    await TestBed.compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('submit button disabled until comments are non-empty and action selected', () => {
    const fixture = TestBed.createComponent(CheckerSubmissionDetailComponent);
    fixture.detectChanges();
    flushInitialLoad(httpMock, 's1');
    fixture.detectChanges();

    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="submit-decision-btn"]',
    );
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.disabled).toBe(true);

    // Pick Approve only - still disabled (no comments).
    const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="action-approve"]',
    );
    approveBtn.click();
    fixture.detectChanges();
    expect(submitBtn.disabled).toBe(true);

    // Add whitespace-only comments — still disabled.
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector(
      '[data-testid="comments-input"]',
    );
    textarea.value = '   ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(submitBtn.disabled).toBe(true);

    // Real comments → enabled.
    textarea.value = 'looks good';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(submitBtn.disabled).toBe(false);
  });

  it('clicking submit POSTs the decision and shows success', () => {
    const fixture = TestBed.createComponent(CheckerSubmissionDetailComponent);
    fixture.detectChanges();
    flushInitialLoad(httpMock, 's1');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="action-reject"]').click();
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector(
      '[data-testid="comments-input"]',
    );
    textarea.value = 'incomplete';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="submit-decision-btn"]').click();
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/submissions/s1/decision');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ action: 'reject', comments: 'incomplete' });
    req.flush({
      id: 's1',
      vendorId: 'v',
      status: 'Rejected',
      currentStep: 7,
      formDataJson: {},
    });
    fixture.detectChanges();

    const success: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="decision-success"]',
    );
    expect(success).toBeTruthy();
  });
});
