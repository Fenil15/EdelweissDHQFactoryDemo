import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AuditLogComponent } from './audit-log.component';

function flushList(httpMock: HttpTestingController, rows: unknown[], total: number): void {
  const req = httpMock.expectOne((r) => r.url === '/api/audit-logs');
  req.flush({ rows, total });
}

describe('AuditLogComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditLogComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('on init loads rows from /api/audit-logs and renders them', () => {
    const fixture = TestBed.createComponent(AuditLogComponent);
    fixture.detectChanges();
    flushList(
      httpMock,
      [
        {
          id: 'a1',
          submissionId: 's1',
          action: 'submit',
          fromStatus: 'Draft',
          toStatus: 'In-Process',
          comments: null,
          actorUserId: 'u1',
          actorEmail: 'v@example.com',
          createdAt: '2026-05-25T10:00:00Z',
        },
      ],
      1,
    );
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="audit-row"]');
    expect(rows.length).toBe(1);
    expect((rows[0].textContent ?? '').trim()).toContain('submit');
    expect((rows[0].textContent ?? '').trim()).toContain('v@example.com');
  });

  it('Next button increments offset and re-queries', () => {
    const fixture = TestBed.createComponent(AuditLogComponent);
    fixture.detectChanges();
    flushList(httpMock, [], 100);
    fixture.detectChanges();

    const next: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="next-btn"]',
    );
    expect(next).toBeTruthy();
    next.click();
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/audit-logs' && r.params.get('offset') === '50',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ rows: [], total: 100 });
  });
});
