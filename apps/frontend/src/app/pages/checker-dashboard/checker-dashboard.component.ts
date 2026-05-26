import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Submission,
  SubmissionListFilters,
  SubmissionService,
  SubmissionStatus,
} from '../../core/submission/submission.service';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

const ALL_STATUSES: SubmissionStatus[] = [
  'Draft',
  'In-Process',
  'Completed',
  'Rejected',
  'Modification-Required',
];

/**
 * Checker work-list. Defaults to In-Process. The "All statuses" toggle clears
 * the status filter so a checker can also see historic decisions when they
 * need to. Filters are applied via an explicit Apply button (and on toggle
 * change) so each keystroke doesn't fire a request.
 */
@Component({
  selector: 'app-checker-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="max-w-5xl mx-auto p-6 space-y-6">
      <h1 class="text-2xl font-semibold">Checker dashboard</h1>

      <section class="border rounded p-4 space-y-3" data-testid="filters">
        <div class="flex flex-wrap gap-3 items-end">
          <label class="block">
            <span class="text-xs text-gray-600">Vendor name</span>
            <input
              type="text"
              class="border rounded px-2 py-1 text-sm"
              [(ngModel)]="vendorName"
              data-testid="vendorName-input"
            />
          </label>
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
            <span class="text-xs text-gray-600">From</span>
            <input
              type="date"
              class="border rounded px-2 py-1 text-sm"
              [(ngModel)]="dateFrom"
              data-testid="dateFrom-input"
            />
          </label>
          <label class="block">
            <span class="text-xs text-gray-600">To</span>
            <input
              type="date"
              class="border rounded px-2 py-1 text-sm"
              [(ngModel)]="dateTo"
              data-testid="dateTo-input"
            />
          </label>
          <label class="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              [(ngModel)]="allStatuses"
              (change)="onToggleAllStatuses()"
              data-testid="all-statuses-toggle"
            />
            All statuses
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
        @if (!allStatuses) {
          <div class="flex flex-wrap gap-3 text-sm" data-testid="status-checkboxes">
            @for (s of allStatusOptions; track s) {
              <label class="flex items-center gap-1">
                <input
                  type="checkbox"
                  [checked]="selectedStatuses().includes(s)"
                  (change)="toggleStatus(s)"
                />
                {{ s }}
              </label>
            }
          </div>
        }
      </section>

      <table class="w-full text-sm border rounded overflow-hidden">
        <thead class="bg-gray-50 text-left">
          <tr>
            <th class="p-2">Submission ID</th>
            <th class="p-2">Vendor Name</th>
            <th class="p-2">Submitted At</th>
            <th class="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr class="border-t hover:bg-gray-50" data-testid="checker-row">
              <td class="p-2 font-mono text-xs">
                <a
                  [routerLink]="['/checker', row.id]"
                  class="text-blue-600 underline"
                  data-testid="detail-link"
                >
                  {{ row.id }}
                </a>
              </td>
              <td class="p-2">{{ row.vendorName ?? '—' }}</td>
              <td class="p-2">{{ row.createdAt ?? '' }}</td>
              <td class="p-2"><app-status-badge [status]="row.status" /></td>
            </tr>
          }
          @if (rows().length === 0) {
            <tr>
              <td class="p-3 text-gray-500 italic" colspan="4" data-testid="empty-state">
                No submissions match the current filters.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class CheckerDashboardComponent {
  private readonly submissions = inject(SubmissionService);

  readonly allStatusOptions = ALL_STATUSES;
  readonly rows = signal<Submission[]>([]);
  readonly selectedStatuses = signal<SubmissionStatus[]>(['In-Process']);

  vendorName = '';
  submissionId = '';
  dateFrom = '';
  dateTo = '';
  allStatuses = false;

  constructor() {
    this.applyFilters();
  }

  onToggleAllStatuses(): void {
    if (this.allStatuses) {
      this.selectedStatuses.set([]);
    } else if (this.selectedStatuses().length === 0) {
      // Re-enable a sensible default when the user turns the toggle back off.
      this.selectedStatuses.set(['In-Process']);
    }
    this.applyFilters();
  }

  toggleStatus(s: SubmissionStatus): void {
    this.selectedStatuses.update((curr) =>
      curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s],
    );
  }

  applyFilters(): void {
    const filters: SubmissionListFilters = {};
    if (!this.allStatuses && this.selectedStatuses().length > 0) {
      filters.statuses = this.selectedStatuses();
    }
    if (this.vendorName.trim()) filters.vendorName = this.vendorName.trim();
    if (this.submissionId.trim()) filters.submissionId = this.submissionId.trim();
    if (this.dateFrom) filters.dateFrom = this.dateFrom;
    if (this.dateTo) filters.dateTo = this.dateTo;
    this.submissions.list(filters).subscribe((rows) => this.rows.set(rows));
  }
}
