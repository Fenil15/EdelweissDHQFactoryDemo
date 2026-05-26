import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuditLogService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuditLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list({}) GETs /api/audit-logs with no params', () => {
    service.list({}).subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/audit-logs');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ rows: [], total: 0 });
  });

  it('list({...}) GETs /api/audit-logs with filter + pagination params', () => {
    service
      .list({
        submissionId: 'abc',
        action: 'approve',
        actorEmail: 'c@',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-26',
        limit: 25,
        offset: 50,
      })
      .subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/audit-logs');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('submissionId')).toBe('abc');
    expect(req.request.params.get('action')).toBe('approve');
    expect(req.request.params.get('actorEmail')).toBe('c@');
    expect(req.request.params.get('dateFrom')).toBe('2026-05-01');
    expect(req.request.params.get('dateTo')).toBe('2026-05-26');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.get('offset')).toBe('50');
    req.flush({ rows: [], total: 0 });
  });
});
