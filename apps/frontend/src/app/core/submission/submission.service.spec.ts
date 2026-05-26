import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SubmissionService } from './submission.service';

describe('SubmissionService', () => {
  let service: SubmissionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SubmissionService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SubmissionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('createDraft POSTs to /api/submissions with an empty body', () => {
    service.createDraft().subscribe();
    const req = httpMock.expectOne('/api/submissions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({
      id: 's1',
      vendorId: 'v1',
      status: 'Draft',
      currentStep: 1,
      formDataJson: {},
    });
  });

  it('getDraft GETs /api/submissions/:id', () => {
    service.getDraft('s1').subscribe();
    const req = httpMock.expectOne('/api/submissions/s1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 's1', vendorId: 'v1', status: 'Draft', currentStep: 1, formDataJson: {} });
  });

  it('updateDraft PUTs /api/submissions/:id with the patch body', () => {
    service
      .updateDraft('s1', {
        currentStep: 2,
        formDataJson: { companyInfo: { panNumber: 'ABCDE1234F' } },
      })
      .subscribe();
    const req = httpMock.expectOne('/api/submissions/s1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      currentStep: 2,
      formDataJson: { companyInfo: { panNumber: 'ABCDE1234F' } },
    });
    req.flush({
      id: 's1',
      vendorId: 'v1',
      status: 'Draft',
      currentStep: 2,
      formDataJson: { companyInfo: { panNumber: 'ABCDE1234F' } },
    });
  });

  it('listDrafts GETs /api/submissions?status=Draft', () => {
    service.listDrafts().subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/submissions');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('Draft');
    req.flush([]);
  });

  it('list({ statuses, vendorName, submissionId, dateFrom, dateTo }) builds the right params', () => {
    service
      .list({
        statuses: ['In-Process', 'Draft'],
        vendorName: 'Acme',
        submissionId: 'abc',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-26',
      })
      .subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/submissions');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('In-Process,Draft');
    expect(req.request.params.get('vendorName')).toBe('Acme');
    expect(req.request.params.get('submissionId')).toBe('abc');
    expect(req.request.params.get('dateFrom')).toBe('2026-05-01');
    expect(req.request.params.get('dateTo')).toBe('2026-05-26');
    req.flush([]);
  });

  it('list({}) sends no query params', () => {
    service.list({}).subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/submissions');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('getById GETs /api/submissions/:id', () => {
    service.getById('xyz').subscribe();
    const req = httpMock.expectOne('/api/submissions/xyz');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'xyz',
      vendorId: 'v',
      status: 'In-Process',
      currentStep: 7,
      formDataJson: {},
    });
  });

  it('submitDraft POSTs to /api/submissions/:id/submit with an empty body', () => {
    service.submitDraft('s1').subscribe();
    const req = httpMock.expectOne('/api/submissions/s1/submit');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({
      id: 's1',
      vendorId: 'v1',
      status: 'In-Process',
      currentStep: 7,
      formDataJson: {},
    });
  });

  it('submitDecision POSTs action + comments to /api/submissions/:id/decision', () => {
    service.submitDecision('s1', 'approve', 'looks good').subscribe();
    const req = httpMock.expectOne('/api/submissions/s1/decision');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ action: 'approve', comments: 'looks good' });
    req.flush({
      id: 's1',
      vendorId: 'v',
      status: 'Completed',
      currentStep: 7,
      formDataJson: {},
    });
  });

  it('getAuditTrail GETs /api/submissions/:id/audit', () => {
    service.getAuditTrail('s1').subscribe();
    const req = httpMock.expectOne('/api/submissions/s1/audit');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
