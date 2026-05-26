import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Submission, SubmissionService } from '../../core/submission/submission.service';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="max-w-3xl mx-auto p-6 space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold">Vendor dashboard</h1>
        <button
          class="px-3 py-2 rounded bg-brand hover:bg-brand-dark text-white"
          data-testid="start-new-btn"
          (click)="startNew()"
        >
          Start new submission
        </button>
      </div>

      <section class="space-y-2">
        <h2 class="text-lg font-medium">Your submissions</h2>
        @if (submissions().length === 0) {
          <p class="text-sm text-gray-600" data-testid="no-submissions">
            You have no submissions yet.
          </p>
        }
        <ul class="divide-y border rounded">
          @for (s of submissions(); track s.id) {
            <li class="flex items-center justify-between p-3" data-testid="submission-row">
              <div class="flex items-center gap-3">
                <app-status-badge [status]="s.status" />
                <div>
                  <p class="font-medium">Submission {{ s.id }}</p>
                  <p class="text-xs text-gray-600">Saved at step {{ s.currentStep }} of 7</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <a
                  [routerLink]="['/vendor/submissions', s.id, 'timeline']"
                  class="text-sm text-brand underline"
                  data-testid="timeline-link"
                >
                  Timeline
                </a>
                @if (canResume(s)) {
                  <a
                    [routerLink]="['/vendor/submissions', s.id]"
                    class="text-sm text-brand underline"
                    data-testid="resume-link"
                  >
                    Resume
                  </a>
                }
              </div>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class VendorDashboardComponent {
  private readonly submissionService = inject(SubmissionService);
  private readonly router = inject(Router);

  readonly submissions = signal<Submission[]>([]);
  // Kept for backwards-compatibility with anything that imported `drafts`.
  readonly drafts = computed(() => this.submissions().filter((s) => s.status === 'Draft'));

  constructor() {
    this.submissionService.list({}).subscribe((rows) => this.submissions.set(rows));
  }

  canResume(s: Submission): boolean {
    return s.status === 'Draft' || s.status === 'Modification-Required';
  }

  startNew(): void {
    this.submissionService.createDraft().subscribe((s) => {
      this.router.navigate(['/vendor/submissions', s.id]);
    });
  }
}
