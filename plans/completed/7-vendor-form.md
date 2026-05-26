# Plan — Issue #7: Vendor multi-step form (7 steps) + format validation + draft persistence

> Source: issue 7 — https://github.com/Fenil15/EdelweissDHQFactoryDemo/issues/7
> Notion page: 36b876cd42cc80e08992c47564e48b41
> Parent PRD: #2
> Cut from: `feat/6-auth`
> Out of scope (do NOT implement): document upload (#8), submit-for-review (#9).

## 1. Backend endpoints

All mounted under `/api/submissions`, behind `requireJwt` + `requireRole('vendor')`. Vendor scope is enforced by joining the JWT `userId` to a `Vendor` row (auto-provisioning the row on first call if missing — the Vendor table currently only has `userId` + `companyName`).

| Method | Path                   | Purpose                                          | Notes                                                                                                                                                                                                      |
| ------ | ---------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/submissions`     | Create a Draft submission for the current vendor | Returns `201` + body. Idempotent: if vendor already owns a Draft and the client passes no body fields, return the existing draft instead of stacking duplicates? — keep simple: always create a new Draft. |
| PUT    | `/api/submissions/:id` | Update an existing Draft                         | Rejects (`409 invalid_status`) if status != `Draft`. Owner-only (`403 forbidden` otherwise). Validates supplied format fields and returns `400` + `errors: { field: code }` map on bad PAN/GSTIN/IFSC/PIN. |
| GET    | `/api/submissions/:id` | Read a submission                                | Owner-only RBAC: any vendor that doesn't own the row gets `404` (we don't leak existence).                                                                                                                 |
| GET    | `/api/submissions`     | List submissions for the current vendor          | Supports `?status=Draft` filter. Returns `[{id, status, currentStep, updatedAt}]` sorted by `updatedAt DESC`.                                                                                              |

Errors are uniform: `{ error: '<code>' }` for top-level codes, and for validation failures `{ error: 'invalid_format', errors: { panNumber: 'invalid_pan', ... } }`.

## 2. Server-side format validators

Single module `apps/backend/src/services/format-validators.ts` exporting pure functions, plus a `validateFormatFields(data)` helper that returns a `{ [field]: code }` error map (empty when valid). Unknown fields are ignored. Empty/undefined values are treated as "absent" (no error) — required-field enforcement is layered separately (and stays light in #7 because the form is allowed to be saved as a draft mid-fill).

Regexes used (exactly):

| Field        | Regex                                                         | Source                                                                                        |
| ------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| PAN          | `/^[A-Z]{5}[0-9]{4}[A-Z]$/`                                   | Issue acceptance criteria.                                                                    |
| GSTIN        | `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/` | Standard 15-char GSTIN (state-code (2 digits) + 10-char PAN + entity (1) + Z + checksum (1)). |
| IFSC         | `/^[A-Z]{4}0[A-Z0-9]{6}$/`                                    | Issue acceptance criteria.                                                                    |
| PIN (postal) | `/^[1-9][0-9]{5}$/`                                           | India PIN: 6 digits, first must not be 0.                                                     |

The validator module exports each regex plus `isValidPan`, `isValidGstin`, `isValidIfsc`, `isValidPin`, `validateFormatFields`.

## 3. Submission entity field shape

The existing entity already has the right shape for "draft + JSON column for the 7 sections":

- `id` (uuid, PK)
- `vendorId` (uuid, FK to vendors)
- `status` (`Draft | In-Process | Completed | Rejected | Modification-Required`, default `Draft`)
- `formDataJson` (`jsonb`, default `{}`) — holds the 7 sections keyed by step name
- `currentStep` (`int`, default `1`) — last step the wizard advanced past (used by "resume")
- `createdAt`, `updatedAt`

`formDataJson` shape (free-form JSON, validated only where format matters):

```ts
{
  companyInfo:  { companyName?: string, panNumber?: string, dateOfIncorporation?: string, businessType?: string },
  contact:      { primaryName?: string, email?: string, phone?: string, designation?: string },
  banking:      { accountHolderName?: string, accountNumber?: string, ifsc?: string, bankName?: string },
  taxIds:       { gstin?: string, tan?: string, cin?: string },
  address:      { line1?: string, line2?: string, city?: string, state?: string, pin?: string },
  documents:    { /* placeholder for #8 — left as {} */ },
  review:       { /* derived view; not stored as input */ }
}
```

No schema migration is needed — the entity already exists and we extend in-place. `formDataJson` is just a `Record<string, unknown>` at the TS layer; we don't strict-type it on the entity to keep #8 free to add doc references.

## 4. Frontend module shape — single component + step index

I picked **one** `SubmissionFormComponent` with a stepper (driven by a `currentStep` signal), not 7 lazy routes.

Reasons:

- The form is a single FormGroup with seven nested FormGroups — splitting across lazy components would force shared-state lifting (a service or input/output every step) for the same FormGroup. Pointless complexity.
- Progress bar + Next/Back are top-level controls that belong with the parent component.
- "Resume at step N" maps cleanly to `currentStep.set(saved.currentStep)`.
- Each step renders inline (small `@switch` block in the template), keeping unit testing trivial — no router gymnastics.

Routes added:

- `vendor/submissions/new` → start a new draft (POST then navigate to `:id`).
- `vendor/submissions/:id` → load existing draft and resume at `currentStep`.

The vendor dashboard renders a "Start new submission" button and a list of drafts (from `GET /api/submissions?status=Draft`) each linking to `/vendor/submissions/:id`.

## 5. Reactive Forms structure

```ts
form = this.fb.group({
  companyInfo: this.fb.group({
    companyName: ['', Validators.required],
    panNumber: ['', [Validators.required, Validators.pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/)]],
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
    ifsc: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)]],
    bankName: ['', Validators.required],
  }),
  taxIds: this.fb.group({
    gstin: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/),
      ],
    ],
    tan: [''],
    cin: [''],
  }),
  address: this.fb.group({
    line1: ['', Validators.required],
    line2: [''],
    city: ['', Validators.required],
    state: ['', Validators.required],
    pin: ['', [Validators.required, Validators.pattern(/^[1-9][0-9]{5}$/)]],
  }),
  documents: this.fb.group({}), // placeholder for #8
  review: this.fb.group({}), // computed, not stored
});
```

- `steps = ['companyInfo','contact','banking','taxIds','address','documents','review']` (length 7).
- Progress bar: `(currentStep() / 7) * 100`.
- Next button: disabled when `form.get(currentStepKey()).invalid` (skipped for `documents` which has no controls in #7, and `review` is read-only).
- "Save as Draft" on each step: PUT `/api/submissions/:id` with the current FormGroup value merged into `formDataJson` and `currentStep` set to the step index. Async — never blocks navigation.
- On Next: optimistically advance step locally, then PUT the draft. (Easy UX, easy test.)
- On component load with route param `id`: GET `/api/submissions/:id` and `form.patchValue(saved.formDataJson)` + `currentStep.set(saved.currentStep)`.

## 6. Where draft "save and resume" hooks into the vendor dashboard

The placeholder `VendorDashboardComponent` becomes a real component:

- On init, calls `SubmissionService.listDrafts()` → `GET /api/submissions?status=Draft`.
- Renders:
  - `Start new submission` button → POST a Draft, then `router.navigate(['/vendor/submissions', newId])`.
  - A table of drafts with a `Resume` link per row → `router.navigate(['/vendor/submissions', draft.id])`.

## 7. TDD slices

Each slice is one **red** (one failing test, run only that test, commit message starts with `add failing test for ...`) followed by one **green** (minimal code, full backend/frontend suite passes, commit message starts with `implement ...`).

### Backend

1. **Validators unit test** — `validators.test.ts` asserts PAN/GSTIN/IFSC/PIN accept canonical valid examples and reject malformed ones (one per regex).
2. **Validators module** — implement `format-validators.ts`.
3. **POST /api/submissions** integration test — authenticated vendor POSTs, gets `201` + body with `status: 'Draft'`, `currentStep: 1`, and a `vendorId` matching the JWT user. Unauthenticated → 401. Non-vendor role (admin) → 403.
4. Implement POST handler (and Vendor auto-provisioning).
5. **GET /api/submissions/:id** — owner sees their own (200), another vendor returns 404, admin returns 403.
6. Implement GET handler.
7. **PUT /api/submissions/:id** — happy path (Draft + valid format) returns 200 + merged body. Invalid PAN returns 400 with `errors.panNumber === 'invalid_pan'`. Non-Draft status returns 409. Non-owner returns 404.
8. Implement PUT handler.
9. **GET /api/submissions** list — `?status=Draft` returns the vendor's own drafts only.
10. Implement list handler.

### Frontend

11. **SubmissionService spec** — `createDraft()` POSTs to `/api/submissions`, `getDraft(id)` GETs, `updateDraft(id, patch)` PUTs, `listDrafts()` GETs with `?status=Draft`. Use `HttpTestingController`.
12. Implement `SubmissionService`.
13. **SubmissionFormComponent spec** — renders, displays step 1 (Company Info) inputs, progress bar shows "Step 1 of 7", Next button is disabled when company-info inputs are empty.
14. Implement the component shell with step state, progress bar, Next/Back.
15. **Validator-bound input test** — invalid PAN (`'INVALID'`) leaves the Next button disabled and shows `Invalid PAN format`; valid PAN (`'ABCDE1234F'`) enables Next.
16. Wire PAN/GSTIN/IFSC/PIN validators + inline error messages.
17. **Next-persists-to-backend test** — clicking Next from step 1 with a valid form issues a `PUT /api/submissions/:id` containing the FormGroup value under `formDataJson.companyInfo`.
18. Implement the save-on-Next call in the component.
19. **VendorDashboard spec** — lists drafts from `GET /api/submissions?status=Draft` and each row has a `Resume` link pointing to `/vendor/submissions/:id`.
20. Implement the dashboard.

Slice 6 (`documents`) is intentionally a no-op step — wired in the wizard with a "Coming soon (handled in #8)" panel. Slice 7 (`review`) shows a read-only summary; no submit button (that lands in #9).

## 8. Files I expect to add or touch

```
apps/backend/src/services/format-validators.ts              (new)
apps/backend/src/services/submission.service.ts             (new)
apps/backend/src/routes/submissions.ts                      (new)
apps/backend/src/app.ts                                     (edit — mount router)
apps/backend/src/__tests__/format-validators.test.ts        (new)
apps/backend/src/__tests__/submissions.test.ts              (new)

apps/frontend/src/app/core/submission/submission.service.ts        (new)
apps/frontend/src/app/core/submission/submission.service.spec.ts   (new)
apps/frontend/src/app/pages/submission-form/submission-form.component.ts        (new)
apps/frontend/src/app/pages/submission-form/submission-form.component.spec.ts   (new)
apps/frontend/src/app/pages/vendor-dashboard/vendor-dashboard.component.ts      (edit)
apps/frontend/src/app/pages/vendor-dashboard/vendor-dashboard.component.spec.ts (new)
apps/frontend/src/app/app.routes.ts                                              (edit — add /vendor/submissions/...)
```
