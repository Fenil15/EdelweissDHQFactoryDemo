import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DecisionAction,
  Submission,
  SubmissionService,
} from '../../core/submission/submission.service';
import { DocumentService, DocumentDto } from '../../core/documents/document.service';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

const DECISION_LABELS: Record<DecisionAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  'request-modification': 'Request Modification',
};

/**
 * Checker view for a single submission: read-only render of `formDataJson`,
 * list of uploaded documents (with download links), plus the decision panel.
 *
 * Submit is gated client-side too — the backend already returns 422 when
 * comments are empty, but disabling the button until both an action and
 * non-whitespace comments are present is part of the AC.
 */
@Component({
  selector: 'app-checker-submission-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <div class="flex items-center gap-3">
        <a routerLink="/checker" class="text-sm text-blue-600 underline">← Back</a>
        <h1 class="text-2xl font-semibold">Submission</h1>
        @if (submission(); as s) {
          <app-status-badge [status]="s.status" />
        }
      </div>

      @if (submission(); as s) {
        <section class="border rounded p-4 space-y-2">
          <h2 class="text-lg font-medium">Submission summary</h2>
          <p class="text-sm">
            <span class="text-gray-600">ID:</span>
            <span class="font-mono text-xs">{{ s.id }}</span>
          </p>
          <p class="text-sm">
            <span class="text-gray-600">Vendor:</span> {{ s.vendorName ?? '—' }}
          </p>
          <pre
            class="text-xs bg-gray-50 border rounded p-3 overflow-x-auto"
            data-testid="form-json"
            >{{ s.formDataJson | json }}</pre
          >
        </section>

        <section class="border rounded p-4 space-y-2" data-testid="documents-section">
          <h2 class="text-lg font-medium">Documents</h2>
          @if (documents().length === 0) {
            <p class="text-sm italic text-gray-500" data-testid="no-documents">
              No documents attached.
            </p>
          } @else {
            <ul class="divide-y border rounded">
              @for (doc of documents(); track doc.id) {
                <li class="flex items-center justify-between p-2" data-testid="document-row">
                  <span class="text-sm">{{ doc.fileName }}</span>
                  <a
                    class="text-sm text-blue-600 underline"
                    [href]="downloadUrl(doc.id)"
                    target="_blank"
                    rel="noopener"
                    >Download</a
                  >
                </li>
              }
            </ul>
          }
        </section>

        <section class="border rounded p-4 space-y-3" data-testid="decision-panel">
          <h2 class="text-lg font-medium">Decision</h2>
          <div class="flex gap-2">
            @for (a of actions; track a) {
              <button
                type="button"
                class="px-3 py-1 rounded border text-sm"
                [class.bg-blue-600]="selectedAction() === a"
                [class.text-white]="selectedAction() === a"
                (click)="selectedAction.set(a)"
                [attr.data-testid]="'action-' + a"
              >
                {{ labelFor(a) }}
              </button>
            }
          </div>
          <label class="block">
            <span class="text-sm text-gray-600">Comments (required)</span>
            <textarea
              rows="3"
              class="w-full border rounded px-2 py-1 text-sm"
              [ngModel]="comments()"
              (ngModelChange)="comments.set($event)"
              data-testid="comments-input"
            ></textarea>
          </label>
          @if (error()) {
            <p class="text-sm text-red-600" data-testid="decision-error">{{ error() }}</p>
          }
          @if (success()) {
            <p class="text-sm text-green-700" data-testid="decision-success">
              Decision recorded. New status: {{ submission()?.status }}.
            </p>
          }
          <button
            type="button"
            class="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            [disabled]="!canSubmit()"
            (click)="submit()"
            data-testid="submit-decision-btn"
          >
            Submit decision
          </button>
        </section>
      }
    </div>
  `,
})
export class CheckerSubmissionDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly submissions = inject(SubmissionService);
  private readonly docService = inject(DocumentService);

  readonly actions: DecisionAction[] = ['approve', 'reject', 'request-modification'];
  readonly submission = signal<Submission | null>(null);
  readonly documents = signal<DocumentDto[]>([]);
  readonly selectedAction = signal<DecisionAction | null>(null);
  readonly comments = signal('');
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  readonly canSubmit = computed(
    () => !!this.selectedAction() && this.comments().trim().length > 0,
  );

  private submissionId: string | null = null;

  constructor() {
    this.route.paramMap.subscribe((p) => {
      const id = p.get('id');
      if (!id) return;
      this.submissionId = id;
      this.submissions.getById(id).subscribe((s) => this.submission.set(s));
      this.docService.listForSubmission(id).subscribe({
        next: (docs) => this.documents.set(docs),
        error: () => this.documents.set([]),
      });
    });
  }

  labelFor(a: DecisionAction): string {
    return DECISION_LABELS[a];
  }

  downloadUrl(id: string): string {
    return this.docService.downloadUrl(id);
  }

  submit(): void {
    if (!this.submissionId || !this.selectedAction()) return;
    const trimmed = this.comments().trim();
    if (trimmed.length === 0) return;
    this.error.set(null);
    this.submissions
      .submitDecision(this.submissionId, this.selectedAction()!, trimmed)
      .subscribe({
        next: (s) => {
          this.submission.set(s);
          this.success.set(true);
        },
        error: (err: { error?: { error?: string } }) => {
          this.error.set(err?.error?.error ?? 'Decision failed.');
        },
      });
  }
}
