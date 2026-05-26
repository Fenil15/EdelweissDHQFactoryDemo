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

  it('lists all submissions and renders a status badge per row', () => {
    const fixture = TestBed.createComponent(VendorDashboardComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/api/submissions');
    expect(req.request.method).toBe('GET');
    // No status filter — vendor sees everything they own.
    expect(req.request.params.get('status')).toBeNull();
    req.flush([
      { id: 'd1', vendorId: 'v', status: 'Draft', currentStep: 2, formDataJson: {} },
      { id: 'p1', vendorId: 'v', status: 'In-Process', currentStep: 7, formDataJson: {} },
      { id: 'c1', vendorId: 'v', status: 'Completed', currentStep: 7, formDataJson: {} },
      { id: 'r1', vendorId: 'v', status: 'Rejected', currentStep: 7, formDataJson: {} },
      {
        id: 'm1',
        vendorId: 'v',
        status: 'Modification-Required',
        currentStep: 7,
        formDataJson: {},
      },
    ]);
    fixture.detectChanges();

    const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="submission-row"]',
    );
    expect(rows.length).toBe(5);

    const badges: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="status-badge"]',
    );
    expect(badges.length).toBe(5);
    expect(badges[0].textContent?.trim()).toBe('Draft');
    expect(badges[0].className).toContain('bg-gray-200');
    expect(badges[1].className).toContain('bg-blue-100');
    expect(badges[2].className).toContain('bg-green-100');
    expect(badges[3].className).toContain('bg-red-100');
    expect(badges[4].className).toContain('bg-yellow-100');

    const timelineLinks: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="timeline-link"]',
    );
    expect(timelineLinks[0].getAttribute('href')).toBe('/vendor/submissions/d1/timeline');
    expect(timelineLinks[4].getAttribute('href')).toBe('/vendor/submissions/m1/timeline');
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
