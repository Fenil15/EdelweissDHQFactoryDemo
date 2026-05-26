import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Submission, SubmissionService } from '../../core/submission/submission.service';

@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-3xl mx-auto p-6 space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold">Vendor dashboard</h1>
        <button
          class="px-3 py-2 rounded bg-blue-600 text-white"
          data-testid="start-new-btn"
          (click)="startNew()"
        >
          Start new submission
        </button>
      </div>

      <section class="space-y-2">
        <h2 class="text-lg font-medium">Drafts</h2>
        @if (drafts().length === 0) {
          <p class="text-sm text-gray-600" data-testid="no-drafts">
            You have no drafts in progress.
          </p>
        }
        <ul class="divide-y border rounded">
          @for (d of drafts(); track d.id) {
            <li class="flex items-center justify-between p-3" data-testid="draft-row">
              <div>
                <p class="font-medium">Submission {{ d.id }}</p>
                <p class="text-xs text-gray-600">Saved at step {{ d.currentStep }} of 7</p>
              </div>
              <a
                [routerLink]="['/vendor/submissions', d.id]"
                class="text-blue-600 underline"
                data-testid="resume-link"
              >
                Resume
              </a>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class VendorDashboardComponent {
  private readonly submissions = inject(SubmissionService);
  private readonly router = inject(Router);

  readonly drafts = signal<Submission[]>([]);

  constructor() {
    this.submissions.listDrafts().subscribe((rows) => this.drafts.set(rows));
  }

  startNew(): void {
    this.submissions.createDraft().subscribe((s) => {
      this.router.navigate(['/vendor/submissions', s.id]);
    });
  }
}
