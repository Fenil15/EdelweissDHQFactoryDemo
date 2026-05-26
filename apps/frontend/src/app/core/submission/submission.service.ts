import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type SubmissionStatus =
  | 'Draft'
  | 'In-Process'
  | 'Completed'
  | 'Rejected'
  | 'Modification-Required';

export interface Submission {
  id: string;
  vendorId: string;
  status: SubmissionStatus;
  currentStep: number;
  formDataJson: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface DraftPatch {
  formDataJson?: Record<string, unknown>;
  currentStep?: number;
}

/**
 * Thin HTTP client around the /api/submissions endpoints. The auth
 * interceptor (already wired up app-wide) attaches the JWT for us — this
 * service stays focused on URL shape and request bodies.
 */
@Injectable({ providedIn: 'root' })
export class SubmissionService {
  private readonly http = inject(HttpClient);

  createDraft(): Observable<Submission> {
    return this.http.post<Submission>('/api/submissions', {});
  }

  getDraft(id: string): Observable<Submission> {
    return this.http.get<Submission>(`/api/submissions/${id}`);
  }

  updateDraft(id: string, patch: DraftPatch): Observable<Submission> {
    return this.http.put<Submission>(`/api/submissions/${id}`, patch);
  }

  listDrafts(): Observable<Submission[]> {
    const params = new HttpParams().set('status', 'Draft');
    return this.http.get<Submission[]>('/api/submissions', { params });
  }
}
