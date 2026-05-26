import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuditEntry, SubmissionService } from '../../core/submission/submission.service';

/**
 * Read-only timeline of audit-log entries for a single submission. Vendors
 * land here from their dashboard; checkers/admins reach it via /checker/:id
 * if they want the long view (not wired into navigation in #10 — the detail
 * page already shows the latest status).
 */
@Component({
  selector: 'app-submission-timeline',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-3xl mx-auto p-6 space-y-6">
      <div class="flex items-center gap-3">
        <a routerLink="/vendor" class="text-sm text-brand underline">← Back</a>
        <h1 class="text-2xl font-semibold">Submission timeline</h1>
      </div>

      @if (entries().length === 0) {
        <p class="text-sm italic text-gray-500" data-testid="timeline-empty">
          No state changes have been recorded for this submission yet.
        </p>
      } @else {
        <ol class="border rounded divide-y">
          @for (e of entries(); track e.id) {
            <li class="p-3" data-testid="timeline-entry">
              <p class="text-sm">
                <span class="font-medium">{{ e.action }}</span>
                <span class="text-gray-600 ml-2">
                  {{ e.fromStatus ?? '—' }} → {{ e.toStatus ?? '—' }}
                </span>
              </p>
              <p class="text-xs text-gray-500">
                {{ e.createdAt }} ·
                {{ e.actorEmail ?? e.actorUserId }}
              </p>
              @if (e.comments) {
                <p class="text-sm mt-1">{{ e.comments }}</p>
              }
            </li>
          }
        </ol>
      }
    </div>
  `,
})
export class SubmissionTimelineComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly submissions = inject(SubmissionService);

  readonly entries = signal<AuditEntry[]>([]);

  constructor() {
    this.route.paramMap.subscribe((p) => {
      const id = p.get('id');
      if (!id) return;
      this.submissions.getAuditTrail(id).subscribe((rows) => this.entries.set(rows));
    });
  }
}
