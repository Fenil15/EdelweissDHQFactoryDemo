import { TestBed } from '@angular/core/testing';
import { StatusBadgeComponent } from './status-badge.component';
import type { SubmissionStatus } from '../../core/submission/submission.service';

describe('StatusBadgeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatusBadgeComponent] }).compileComponents();
  });

  const cases: Array<{ status: SubmissionStatus; expectedClass: string }> = [
    { status: 'Draft', expectedClass: 'bg-gray-200' },
    { status: 'In-Process', expectedClass: 'bg-blue-100' },
    { status: 'Completed', expectedClass: 'bg-green-100' },
    { status: 'Rejected', expectedClass: 'bg-red-100' },
    { status: 'Modification-Required', expectedClass: 'bg-yellow-100' },
  ];

  for (const { status, expectedClass } of cases) {
    it(`renders ${status} with a ${expectedClass} pill`, () => {
      const fixture = TestBed.createComponent(StatusBadgeComponent);
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement.querySelector('[data-testid="status-badge"]');
      expect(el).toBeTruthy();
      expect(el.textContent?.trim()).toBe(status);
      expect(el.className).toContain(expectedClass);
    });
  }
});
