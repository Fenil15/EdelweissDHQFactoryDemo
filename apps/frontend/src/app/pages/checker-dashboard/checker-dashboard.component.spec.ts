import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CheckerDashboardComponent } from './checker-dashboard.component';

describe('CheckerDashboardComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckerDashboardComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('on init queries /api/submissions?status=In-Process and lists rows', () => {
    const fixture = TestBed.createComponent(CheckerDashboardComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/submissions' && r.params.get('status') === 'In-Process',
    );
    req.flush([
      {
        id: 's1',
        vendorId: 'v1',
        vendorName: 'Acme',
        status: 'In-Process',
        currentStep: 7,
        formDataJson: {},
        createdAt: '2026-05-25T10:00:00Z',
      },
      {
        id: 's2',
        vendorId: 'v2',
        vendorName: 'Beta',
        status: 'In-Process',
        currentStep: 7,
        formDataJson: {},
        createdAt: '2026-05-24T10:00:00Z',
      },
    ]);
    fixture.detectChanges();

    const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="checker-row"]',
    );
    expect(rows.length).toBe(2);

    const text = (rows[0].textContent ?? '').trim();
    expect(text).toContain('Acme');
    expect(text).toContain('s1');
  });

  it('typing in the vendorName filter re-queries with vendorName param', async () => {
    const fixture = TestBed.createComponent(CheckerDashboardComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/api/submissions').flush([]);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="vendorName-input"]',
    );
    expect(input).toBeTruthy();
    input.value = 'beta';
    input.dispatchEvent(new Event('input'));
    fixture.componentInstance.applyFilters();
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/submissions' && r.params.get('vendorName') === 'beta',
    );
    req.flush([]);
  });

  it('"All statuses" toggle clears the status filter', () => {
    const fixture = TestBed.createComponent(CheckerDashboardComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/api/submissions').flush([]);
    fixture.detectChanges();

    const toggle: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="all-statuses-toggle"]',
    );
    expect(toggle).toBeTruthy();
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/api/submissions');
    expect(req.request.params.get('status')).toBeNull();
    req.flush([]);
  });
});
