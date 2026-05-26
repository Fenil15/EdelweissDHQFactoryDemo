import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DocumentUploadComponent } from './document-upload.component';

const SUBMISSION_ID = 'sub-xyz';

function makeFile(name: string, mime: string, sizeBytes = 4): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: mime });
}

function makeComponent(): {
  fixture: ComponentFixture<DocumentUploadComponent>;
  httpMock: HttpTestingController;
} {
  const fixture = TestBed.createComponent(DocumentUploadComponent);
  fixture.componentInstance.submissionId = SUBMISSION_ID;
  fixture.detectChanges();
  const httpMock = TestBed.inject(HttpTestingController);
  // Initial list fetch on ngOnInit
  const initial = httpMock.expectOne(`/api/submissions/${SUBMISSION_ID}/documents`);
  initial.flush([]);
  fixture.detectChanges();
  return { fixture, httpMock };
}

function pickFile(
  fixture: ComponentFixture<DocumentUploadComponent>,
  file: File,
): void {
  const input = fixture.nativeElement.querySelector(
    '[data-testid="file-input"]',
  ) as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

describe('DocumentUploadComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DocumentUploadComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('renders the empty state when no documents are present', () => {
    const { fixture } = makeComponent();
    const empty = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
    expect(empty).toBeTruthy();
  });

  it('uploads a valid PDF and shows it in the list', () => {
    const { fixture, httpMock } = makeComponent();
    const pdf = makeFile('invoice.pdf', 'application/pdf');
    pickFile(fixture, pdf);

    const req = httpMock.expectOne(`/api/submissions/${SUBMISSION_ID}/documents`);
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'd-1',
      fileName: 'invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      uploadedAt: new Date().toISOString(),
    });
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('[data-testid="doc-list"]');
    expect(list).toBeTruthy();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="doc-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('invoice.pdf');
  });

  it('rejects an .exe client-side without calling the server', () => {
    const { fixture, httpMock } = makeComponent();
    const exe = makeFile('mal.exe', 'application/octet-stream');
    pickFile(fixture, exe);

    httpMock.expectNone(`/api/submissions/${SUBMISSION_ID}/documents`);
    const err = fixture.nativeElement.querySelector('[data-testid="upload-error"]');
    expect(err).toBeTruthy();
    expect(err.textContent).toMatch(/PDF, JPG, or PNG/i);
  });

  it('rejects a > 5 MB file client-side without calling the server', () => {
    const { fixture, httpMock } = makeComponent();
    const huge = makeFile('huge.pdf', 'application/pdf', 6 * 1024 * 1024);
    pickFile(fixture, huge);

    httpMock.expectNone(`/api/submissions/${SUBMISSION_ID}/documents`);
    const err = fixture.nativeElement.querySelector('[data-testid="upload-error"]');
    expect(err).toBeTruthy();
    expect(err.textContent).toMatch(/5 MB/i);
  });

  it('surfaces a backend 415 as an inline error', () => {
    const { fixture, httpMock } = makeComponent();
    const pdf = makeFile('a.pdf', 'application/pdf');
    pickFile(fixture, pdf);

    const req = httpMock.expectOne(`/api/submissions/${SUBMISSION_ID}/documents`);
    req.flush(
      { error: 'unsupported_media_type' },
      { status: 415, statusText: 'Unsupported Media Type' },
    );
    fixture.detectChanges();

    const err = fixture.nativeElement.querySelector('[data-testid="upload-error"]');
    expect(err).toBeTruthy();
    expect(err.textContent).toMatch(/PDF, JPG, or PNG/i);
  });

  it('surfaces a backend 413 as an inline error', () => {
    const { fixture, httpMock } = makeComponent();
    const pdf = makeFile('a.pdf', 'application/pdf');
    pickFile(fixture, pdf);

    const req = httpMock.expectOne(`/api/submissions/${SUBMISSION_ID}/documents`);
    req.flush({ error: 'file_too_large' }, { status: 413, statusText: 'Payload Too Large' });
    fixture.detectChanges();

    const err = fixture.nativeElement.querySelector('[data-testid="upload-error"]');
    expect(err.textContent).toMatch(/5 MB/i);
  });

  it('clicking remove deletes the document and updates the list', () => {
    const { fixture, httpMock } = makeComponent();
    const pdf = makeFile('a.pdf', 'application/pdf');
    pickFile(fixture, pdf);
    const uploadReq = httpMock.expectOne(`/api/submissions/${SUBMISSION_ID}/documents`);
    uploadReq.flush({
      id: 'd-9',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      uploadedAt: new Date().toISOString(),
    });
    fixture.detectChanges();

    const removeBtn = fixture.nativeElement.querySelector(
      '[data-testid="remove-btn"]',
    ) as HTMLButtonElement;
    removeBtn.click();

    const delReq = httpMock.expectOne('/api/documents/d-9');
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="empty-state"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="doc-row"]').length).toBe(0);
  });
});
