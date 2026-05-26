import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type SubmissionStatus =
  | 'Draft'
  | 'In-Process'
  | 'Completed'
  | 'Rejected'
  | 'Modification-Required';

export type DecisionAction = 'approve' | 'reject' | 'request-modification';

export interface Submission {
  id: string;
  vendorId: string;
  vendorName?: string | null;
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

export interface SubmissionListFilters {
  statuses?: SubmissionStatus[];
  vendorName?: string;
  submissionId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AuditEntry {
  id: string;
  submissionId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  comments: string | null;
  actorUserId: string;
  actorEmail: string | null;
  createdAt: string;
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

  /**
   * Cross-vendor list used by the checker dashboard and (with no filters) the
   * vendor dashboard. The backend gates RBAC; this just shapes the query.
   */
  list(filters: SubmissionListFilters): Observable<Submission[]> {
    let params = new HttpParams();
    if (filters.statuses && filters.statuses.length > 0) {
      params = params.set('status', filters.statuses.join(','));
    }
    if (filters.vendorName) params = params.set('vendorName', filters.vendorName);
    if (filters.submissionId) params = params.set('submissionId', filters.submissionId);
    if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
    return this.http.get<Submission[]>('/api/submissions', { params });
  }

  getById(id: string): Observable<Submission> {
    return this.http.get<Submission>(`/api/submissions/${id}`);
  }

  submitDraft(id: string): Observable<Submission> {
    return this.http.post<Submission>(`/api/submissions/${id}/submit`, {});
  }

  submitDecision(id: string, action: DecisionAction, comments: string): Observable<Submission> {
    return this.http.post<Submission>(`/api/submissions/${id}/decision`, { action, comments });
  }

  getAuditTrail(id: string): Observable<AuditEntry[]> {
    return this.http.get<AuditEntry[]>(`/api/submissions/${id}/audit`);
  }
}
