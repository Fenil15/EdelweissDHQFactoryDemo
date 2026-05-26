import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DocumentService } from './document.service';

describe('DocumentService', () => {
  let service: DocumentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DocumentService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocumentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('uploadFile POSTs multipart form to /api/submissions/:id/documents', () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'a.pdf', {
      type: 'application/pdf',
    });
    service.uploadFile('sub-1', file).subscribe();
    const req = httpMock.expectOne('/api/submissions/sub-1/documents');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    req.flush({
      id: 'd1',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      uploadedAt: new Date().toISOString(),
    });
  });

  it('listForSubmission GETs /api/submissions/:id/documents', () => {
    service.listForSubmission('sub-2').subscribe();
    const req = httpMock.expectOne('/api/submissions/sub-2/documents');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('deleteFile DELETEs /api/documents/:id', () => {
    service.deleteFile('d-9').subscribe();
    const req = httpMock.expectOne('/api/documents/d-9');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('downloadUrl returns the streaming endpoint URL', () => {
    expect(service.downloadUrl('abc')).toBe('/api/documents/abc');
  });
});
