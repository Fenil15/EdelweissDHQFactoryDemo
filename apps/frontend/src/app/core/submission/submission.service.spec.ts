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
});
