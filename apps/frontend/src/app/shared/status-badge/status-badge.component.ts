import { Component, computed, input } from '@angular/core';
import type { SubmissionStatus } from '../../core/submission/submission.service';

const BADGE_CLASSES: Record<SubmissionStatus, string> = {
  Draft: 'bg-gray-200 text-gray-800',
  'In-Process': 'bg-blue-100 text-blue-800',
  Completed: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  'Modification-Required': 'bg-yellow-100 text-yellow-800',
};

/**
 * Tiny Tailwind pill that color-codes a submission status. Used by the vendor
 * dashboard, checker dashboard, checker detail header, and timeline page.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span
      class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
      [class]="classes()"
      data-testid="status-badge"
    >
      {{ status() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<SubmissionStatus>();
  readonly classes = computed(() => BADGE_CLASSES[this.status()]);
}
