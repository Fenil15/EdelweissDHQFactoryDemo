import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { AuditEntry } from '../submission/submission.service';

export interface AuditLogListFilters {
  submissionId?: string;
  action?: string;
  actorEmail?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogListResponse {
  rows: AuditEntry[];
  total: number;
}

/**
 * HTTP gateway for the admin audit-log viewer. Vendors and checkers cannot
 * hit this endpoint (403 from the backend); the UI uses the `roleGuard` to
 * keep them off the page in the first place.
 */
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);

  list(filters: AuditLogListFilters): Observable<AuditLogListResponse> {
    let params = new HttpParams();
    if (filters.submissionId) params = params.set('submissionId', filters.submissionId);
    if (filters.action) params = params.set('action', filters.action);
    if (filters.actorEmail) params = params.set('actorEmail', filters.actorEmail);
    if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
    if (typeof filters.limit === 'number') params = params.set('limit', filters.limit.toString());
    if (typeof filters.offset === 'number')
      params = params.set('offset', filters.offset.toString());
    return this.http.get<AuditLogListResponse>('/api/audit-logs', { params });
  }
}
