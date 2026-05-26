import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SubmissionService } from '../../core/submission/submission.service';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PIN_REGEX = /^[1-9][0-9]{5}$/;

const STEP_KEYS = [
  'companyInfo',
  'contact',
  'banking',
  'taxIds',
  'address',
  'documents',
  'review',
] as const;
type StepKey = (typeof STEP_KEYS)[number];

const STEP_TITLES: Record<StepKey, string> = {
  companyInfo: 'Company Info',
  contact: 'Contact',
  banking: 'Banking',
  taxIds: 'Tax IDs',
  address: 'Address',
  documents: 'Documents',
  review: 'Review',
};

@Component({
  selector: 'app-submission-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-2xl mx-auto p-6 space-y-6">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-semibold">Vendor onboarding</h1>
          <span class="text-sm text-gray-600" data-testid="step-indicator">
            Step {{ stepIndex() + 1 }} of {{ totalSteps }}
          </span>
        </div>
        <div class="w-full h-2 bg-gray-200 rounded">
          <div
            class="h-2 bg-brand rounded transition-all"
            data-testid="progress-bar"
            [style.width.%]="progressPct()"
          ></div>
        </div>
        <h2 class="text-lg font-medium" data-testid="step-title">{{ stepTitle() }}</h2>
      </div>

      <form [formGroup]="form" class="space-y-4">
        @switch (currentKey()) {
          @case ('companyInfo') {
            <div formGroupName="companyInfo" class="space-y-3">
              <label class="block">
                <span class="text-sm text-gray-600">Company name</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1"
                  formControlName="companyName"
                  data-testid="companyName-input"
                />
              </label>
              <label class="block">
                <span class="text-sm text-gray-600">PAN</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1 uppercase"
                  formControlName="panNumber"
                  data-testid="panNumber-input"
                />
                @if (showError('companyInfo', 'panNumber', 'pattern')) {
                  <span class="text-sm text-red-600" data-testid="panNumber-error">
                    Invalid PAN format
                  </span>
                }
              </label>
            </div>
          }
          @case ('contact') {
            <div formGroupName="contact" class="space-y-3">
              <label class="block">
                <span class="text-sm text-gray-600">Primary contact name</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1"
                  formControlName="primaryName"
                />
              </label>
              <label class="block">
                <span class="text-sm text-gray-600">Email</span>
                <input
                  type="email"
                  class="w-full border rounded px-2 py-1"
                  formControlName="email"
                />
              </label>
              <label class="block">
                <span class="text-sm text-gray-600">Phone</span>
                <input type="tel" class="w-full border rounded px-2 py-1" formControlName="phone" />
              </label>
            </div>
          }
          @case ('banking') {
            <div formGroupName="banking" class="space-y-3">
              <label class="block">
                <span class="text-sm text-gray-600">Account holder name</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1"
                  formControlName="accountHolderName"
                />
              </label>
              <label class="block">
                <span class="text-sm text-gray-600">Account number</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1"
                  formControlName="accountNumber"
                />
              </label>
              <label class="block">
                <span class="text-sm text-gray-600">IFSC</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1 uppercase"
                  formControlName="ifsc"
                  data-testid="ifsc-input"
                />
                @if (showError('banking', 'ifsc', 'pattern')) {
                  <span class="text-sm text-red-600">Invalid IFSC format</span>
                }
              </label>
              <label class="block">
                <span class="text-sm text-gray-600">Bank name</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1"
                  formControlName="bankName"
                />
              </label>
            </div>
          }
          @case ('taxIds') {
            <div formGroupName="taxIds" class="space-y-3">
              <label class="block">
                <span class="text-sm text-gray-600">GSTIN</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1 uppercase"
                  formControlName="gstin"
                  data-testid="gstin-input"
                />
                @if (showError('taxIds', 'gstin', 'pattern')) {
                  <span class="text-sm text-red-600">Invalid GSTIN format</span>
                }
              </label>
            </div>
          }
          @case ('address') {
            <div formGroupName="address" class="space-y-3">
              <label class="block">
                <span class="text-sm text-gray-600">Line 1</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1"
                  formControlName="line1"
                />
              </label>
              <label class="block">
                <span class="text-sm text-gray-600">City</span>
                <input type="text" class="w-full border rounded px-2 py-1" formControlName="city" />
              </label>
              <label class="block">
                <span class="text-sm text-gray-600">State</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1"
                  formControlName="state"
                />
              </label>
              <label class="block">
                <span class="text-sm text-gray-600">PIN</span>
                <input
                  type="text"
                  class="w-full border rounded px-2 py-1"
                  formControlName="pin"
                  data-testid="pin-input"
                />
                @if (showError('address', 'pin', 'pattern')) {
                  <span class="text-sm text-red-600">Invalid PIN format</span>
                }
              </label>
            </div>
          }
          @case ('documents') {
            <p class="text-sm text-gray-600">
              Document uploads will be enabled in a follow-up release (#8). You can still save and
              advance.
            </p>
          }
          @case ('review') {
            <pre
              class="text-xs bg-gray-50 border rounded p-3 overflow-x-auto"
              data-testid="review-json"
              >{{ form.value | json }}</pre
            >
            @if (submitError()) {
              <p class="text-sm text-red-600" data-testid="submit-error">
                {{ submitError() }}
              </p>
            }
          }
        }
      </form>

      <div class="flex items-center justify-between">
        <button
          class="px-3 py-2 border rounded disabled:opacity-50"
          data-testid="back-btn"
          [disabled]="stepIndex() === 0"
          (click)="goBack()"
        >
          Back
        </button>
        <div class="space-x-2">
          <button
            class="px-3 py-2 border rounded disabled:opacity-50"
            data-testid="save-draft-btn"
            (click)="saveDraft()"
          >
            Save as Draft
          </button>
          <button
            class="px-3 py-2 rounded bg-brand hover:bg-brand-dark text-white disabled:opacity-50"
            data-testid="next-btn"
            [disabled]="!canAdvance()"
            (click)="goNext()"
          >
            {{ ctaLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SubmissionFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly submissions = inject(SubmissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly totalSteps = STEP_KEYS.length;
  readonly stepIndex = signal(0);
  readonly currentKey = computed<StepKey>(() => STEP_KEYS[this.stepIndex()]);
  readonly stepTitle = computed(() => STEP_TITLES[this.currentKey()]);
  readonly progressPct = computed(() =>
    Math.round(((this.stepIndex() + 1) / this.totalSteps) * 100),
  );
  readonly ctaLabel = computed(() => (this.currentKey() === 'review' ? 'Submit' : 'Next'));
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  private submissionId: string | null = null;

  readonly form: FormGroup = this.fb.group({
    companyInfo: this.fb.group({
      companyName: ['', Validators.required],
      panNumber: ['', [Validators.required, Validators.pattern(PAN_REGEX)]],
      dateOfIncorporation: [''],
      businessType: [''],
    }),
    contact: this.fb.group({
      primaryName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      designation: [''],
    }),
    banking: this.fb.group({
      accountHolderName: ['', Validators.required],
      accountNumber: ['', Validators.required],
      ifsc: ['', [Validators.required, Validators.pattern(IFSC_REGEX)]],
      bankName: ['', Validators.required],
    }),
    taxIds: this.fb.group({
      gstin: ['', [Validators.required, Validators.pattern(GSTIN_REGEX)]],
      tan: [''],
      cin: [''],
    }),
    address: this.fb.group({
      line1: ['', Validators.required],
      line2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      pin: ['', [Validators.required, Validators.pattern(PIN_REGEX)]],
    }),
    documents: this.fb.group({}),
    review: this.fb.group({}),
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.submissionId = id;
        this.submissions.getDraft(id).subscribe((s) => {
          if (s.formDataJson) this.form.patchValue(s.formDataJson);
          // Resume at saved step (clamp into bounds in case of bad data).
          const idx = Math.max(0, Math.min(this.totalSteps - 1, (s.currentStep ?? 1) - 1));
          this.stepIndex.set(idx);
        });
      }
    });
  }

  canAdvance(): boolean {
    const key = this.currentKey();
    // `documents` and `review` have no required controls in #7.
    if (key === 'documents' || key === 'review') return true;
    const group = this.form.get(key);
    return !!group && group.valid;
  }

  showError(section: StepKey, control: string, errorKey: string): boolean {
    const ctrl = this.form.get([section, control]) as AbstractControl | null;
    if (!ctrl) return false;
    return !!ctrl.hasError(errorKey) && (ctrl.dirty || ctrl.touched);
  }

  goBack(): void {
    if (this.stepIndex() > 0) this.stepIndex.update((i) => i - 1);
  }

  goNext(): void {
    if (!this.canAdvance()) return;
    if (this.currentKey() === 'review') {
      this.submitReview();
      return;
    }
    const next = Math.min(this.totalSteps - 1, this.stepIndex() + 1);
    this.stepIndex.set(next);
    this.persistDraft(next + 1);
  }

  private submitReview(): void {
    if (!this.submissionId) return;
    this.submitError.set(null);
    this.submitting.set(true);
    this.submissions.submitDraft(this.submissionId).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/vendor');
      },
      error: () => {
        this.submitting.set(false);
        this.submitError.set('Could not submit your application. Please try again.');
      },
    });
  }

  saveDraft(): void {
    this.persistDraft(this.stepIndex() + 1);
  }

  private persistDraft(currentStep: number): void {
    if (!this.submissionId) return;
    this.submissions
      .updateDraft(this.submissionId, {
        currentStep,
        formDataJson: this.form.value,
      })
      .subscribe();
  }
}
