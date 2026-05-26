import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AuditLogListFilters,
  AuditLogService,
} from '../../core/audit/audit-log.service';
import { AuditEntry } from '../../core/submission/submission.service';

const ACTIONS = ['submit', 'approve', 'reject', 'request-modification'] as const;
const PAGE_SIZE = 50;

/**
 * Admin audit-log viewer. Loads from /api/audit-logs with filterable
 * substring matches and a basic Previous/Next pagination over `limit`/
 * `offset`. Pagination state lives client-side; the backend is the source
 * of truth for `total`.
 */
@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <h1 class="text-2xl font-semibold">Audit log</h1>

      <section class="border rounded p-4 space-y-3" data-testid="filters">
        <div class="flex flex-wrap gap-3 items-end">
          <label class="block">
            <span class="text-xs text-gray-600">Submission ID</span>
            <input
              type="text"
              class="border rounded px-2 py-1 text-sm"
              [(ngModel)]="submissionId"
              data-testid="submissionId-input"
            />
          </label>
          <label class="block">
            <span class="text-xs text-gray-600">Action</span>
            <select
              class="border rounded px-2 py-1 text-sm"
              [(ngModel)]="action"
              data-testid="action-select"
            >
              <option value="">All</option>
              @for (a of actions; track a) {
                <option [value]="a">{{ a }}</option>
              }
            </select>
          </label>
          <label class="block">
            <span class="text-xs text-gray-600">Actor email</span>
            <input
              type="text"
              class="border rounded px-2 py-1 text-sm"
              [(ngModel)]="actorEmail"
              data-testid="actorEmail-input"
            />
          </label>
          <label class="block">
            <span class="text-xs text-gray-600">From</span>
            <input
              type="date"
              class="border rounded px-2 py-1 text-sm"
              [(ngModel)]="dateFrom"
            />
          </label>
          <label class="block">
            <span class="text-xs text-gray-600">To</span>
            <input
              type="date"
              class="border rounded px-2 py-1 text-sm"
              [(ngModel)]="dateTo"
            />
          </label>
          <button
            type="button"
            class="px-3 py-1 rounded bg-blue-600 text-white text-sm"
            (click)="applyFilters()"
            data-testid="apply-btn"
          >
            Apply
          </button>
        </div>
      </section>

      <table class="w-full text-sm border rounded overflow-hidden">
        <thead class="bg-gray-50 text-left">
          <tr>
            <th class="p-2">Created at</th>
            <th class="p-2">Action</th>
            <th class="p-2">From → To</th>
            <th class="p-2">Submission</th>
            <th class="p-2">Actor</th>
            <th class="p-2">Comments</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr class="border-t" data-testid="audit-row">
              <td class="p-2">{{ row.createdAt }}</td>
              <td class="p-2">{{ row.action }}</td>
              <td class="p-2">{{ row.fromStatus ?? '—' }} → {{ row.toStatus ?? '—' }}</td>
              <td class="p-2 font-mono text-xs">{{ row.submissionId }}</td>
              <td class="p-2">{{ row.actorEmail ?? row.actorUserId }}</td>
              <td class="p-2">{{ row.comments ?? '' }}</td>
            </tr>
          }
          @if (rows().length === 0) {
            <tr>
              <td colspan="6" class="p-3 italic text-gray-500" data-testid="empty-state">
                No audit entries match the current filters.
              </td>
            </tr>
          }
        </tbody>
      </table>

      <div class="flex items-center justify-between text-sm">
        <span data-testid="pagination-label">
          Showing {{ offset() + 1 }}–{{ pageEnd() }} of {{ total() }}
        </span>
        <div class="space-x-2">
          <button
            type="button"
            class="px-3 py-1 border rounded disabled:opacity-50"
            [disabled]="offset() === 0"
            (click)="prevPage()"
            data-testid="prev-btn"
          >
            Previous
          </button>
          <button
            type="button"
            class="px-3 py-1 border rounded disabled:opacity-50"
            [disabled]="pageEnd() >= total()"
            (click)="nextPage()"
            data-testid="next-btn"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AuditLogComponent {
  private readonly service = inject(AuditLogService);
  readonly actions = ACTIONS;

  readonly rows = signal<AuditEntry[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly limit = signal(PAGE_SIZE);
  readonly pageEnd = computed(() => Math.min(this.offset() + this.limit(), this.total()));

  submissionId = '';
  action = '';
  actorEmail = '';
  dateFrom = '';
  dateTo = '';

  constructor() {
    this.fetch();
  }

  applyFilters(): void {
    this.offset.set(0);
    this.fetch();
  }

  prevPage(): void {
    this.offset.update((o) => Math.max(0, o - this.limit()));
    this.fetch();
  }

  nextPage(): void {
    this.offset.update((o) => o + this.limit());
    this.fetch();
  }

  private fetch(): void {
    const filters: AuditLogListFilters = {
      limit: this.limit(),
      offset: this.offset(),
    };
    if (this.submissionId.trim()) filters.submissionId = this.submissionId.trim();
    if (this.action) filters.action = this.action;
    if (this.actorEmail.trim()) filters.actorEmail = this.actorEmail.trim();
    if (this.dateFrom) filters.dateFrom = this.dateFrom;
    if (this.dateTo) filters.dateTo = this.dateTo;
    this.service.list(filters).subscribe((res) => {
      this.rows.set(res.rows);
      this.total.set(res.total);
    });
  }
}
