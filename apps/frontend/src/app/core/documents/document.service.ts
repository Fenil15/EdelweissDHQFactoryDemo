import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DocumentDto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

/**
 * HTTP gateway for the document endpoints. The auth interceptor attaches the
 * JWT automatically — this service just shapes the requests/responses.
 */
@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);

  uploadFile(submissionId: string, file: File): Observable<DocumentDto> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<DocumentDto>(`/api/submissions/${submissionId}/documents`, form);
  }

  listForSubmission(submissionId: string): Observable<DocumentDto[]> {
    return this.http.get<DocumentDto[]>(`/api/submissions/${submissionId}/documents`);
  }

  deleteFile(documentId: string): Observable<void> {
    return this.http.delete<void>(`/api/documents/${documentId}`);
  }

  downloadUrl(documentId: string): string {
    return `/api/documents/${documentId}`;
  }
}
