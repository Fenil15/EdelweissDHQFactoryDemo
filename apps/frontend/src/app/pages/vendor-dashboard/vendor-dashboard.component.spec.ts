import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Location } from '@angular/common';

import { VendorDashboardComponent } from './vendor-dashboard.component';

describe('VendorDashboardComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let location: Location;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorDashboardComponent],
      providers: [
        provideRouter([
          { path: 'vendor', component: VendorDashboardComponent },
          { path: 'vendor/submissions/:id', component: VendorDashboardComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    await router.navigateByUrl('/vendor');
  });

  afterEach(() => httpMock.verify());

  it('lists drafts returned by GET /api/submissions?status=Draft', () => {
    const fixture = TestBed.createComponent(VendorDashboardComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/submissions' && r.params.get('status') === 'Draft',
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      { id: 'd1', vendorId: 'v', status: 'Draft', currentStep: 2, formDataJson: {} },
      { id: 'd2', vendorId: 'v', status: 'Draft', currentStep: 5, formDataJson: {} },
    ]);
    fixture.detectChanges();

    const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="draft-row"]',
    );
    expect(rows.length).toBe(2);

    const resumeLinks: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="resume-link"]',
    );
    expect(resumeLinks[0].getAttribute('href')).toBe('/vendor/submissions/d1');
    expect(resumeLinks[1].getAttribute('href')).toBe('/vendor/submissions/d2');
  });

  it('Start new submission POSTs and navigates to the new draft', async () => {
    const fixture = TestBed.createComponent(VendorDashboardComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/api/submissions').flush([]);
    fixture.detectChanges();

    const startBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="start-new-btn"]',
    );
    expect(startBtn).toBeTruthy();
    startBtn.click();
    fixture.detectChanges();

    const create = httpMock.expectOne((r) => r.method === 'POST' && r.url === '/api/submissions');
    create.flush({
      id: 'new1',
      vendorId: 'v',
      status: 'Draft',
      currentStep: 1,
      formDataJson: {},
    });
    await fixture.whenStable();

    expect(location.path()).toBe('/vendor/submissions/new1');
  });
});
