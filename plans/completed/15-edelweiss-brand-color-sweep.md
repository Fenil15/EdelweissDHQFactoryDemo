> Source: issue #15
> Notion page: 36c876cd42cc8009aa62d42bc93db05d

# Edelweiss brand color sweep (slice #2 of 2)

Sweep all current Tailwind `bg-blue-600` / `text-blue-600` usages to the new
`bg-brand` / `text-brand` tokens that slice #14 added, so primary buttons,
hyperlinks, and the submission-form progress bar render in Edelweiss royal
blue (#254AA5).

## Class mapping rules

- `bg-blue-600` -> `bg-brand`
- `text-blue-600` -> `text-brand`
- For every BUTTON (or label rendered as a button) that previously used
  `bg-blue-600`, ensure it ends with `hover:bg-brand-dark`. If
  `hover:bg-blue-700` was present, replace it; otherwise add it.
- The submission-form progress bar fill (`bg-blue-600` inside a `div` that is
  NOT a button) becomes `bg-brand` with NO hover variant added.
- Leave `bg-blue-100` and `text-blue-800` UNCHANGED — they belong to
  `StatusBadgeComponent` (In-Process pill) and are explicitly excluded by the
  PRD.

## Files touched

- `apps/frontend/src/app/features/documents/document-upload.component.ts`
  - Choose-a-file label (rendered as a button): `bg-blue-600` + `hover:bg-blue-700`
    -> `bg-brand hover:bg-brand-dark`.
- `apps/frontend/src/app/pages/login/login.component.ts`
  - Two primary buttons (Send OTP, Verify): `bg-blue-600` -> `bg-brand` +
    add `hover:bg-brand-dark`.
- `apps/frontend/src/app/pages/login/login.component.spec.ts`
  - Add a new spec verifying the primary button mounts with `bg-brand`
    (red first, then green).
- `apps/frontend/src/app/pages/audit-log/audit-log.component.ts`
  - Apply button: `bg-blue-600` -> `bg-brand hover:bg-brand-dark`.
- `apps/frontend/src/app/pages/submission-form/submission-form.component.ts`
  - Progress bar fill: `bg-blue-600` -> `bg-brand` (NO hover).
  - Next button: `bg-blue-600` -> `bg-brand hover:bg-brand-dark`.
- `apps/frontend/src/app/pages/checker-submission-detail/checker-submission-detail.component.ts`
  - Back link `text-blue-600` -> `text-brand`.
  - Download link `text-blue-600` -> `text-brand`.
  - Action toggle `[class.bg-blue-600]` binding -> `[class.bg-brand]`.
  - Submit-decision button: `bg-blue-600` -> `bg-brand hover:bg-brand-dark`.
- `apps/frontend/src/app/pages/checker-dashboard/checker-dashboard.component.ts`
  - Apply button: `bg-blue-600` -> `bg-brand hover:bg-brand-dark`.
  - Detail link `text-blue-600` -> `text-brand`.
- `apps/frontend/src/app/pages/home/home.component.html`
  - Four nav links `text-blue-600` -> `text-brand`.
- `apps/frontend/src/app/pages/submission-timeline/submission-timeline.component.ts`
  - Back link `text-blue-600` -> `text-brand`.
- `apps/frontend/src/app/pages/vendor-dashboard/vendor-dashboard.component.ts`
  - Start-new-submission button: `bg-blue-600` -> `bg-brand hover:bg-brand-dark`.
  - Timeline + Resume links `text-blue-600` -> `text-brand`.

`StatusBadgeComponent` and its spec — and the `vendor-dashboard` spec line
asserting `bg-blue-100` for the In-Process pill — are intentionally untouched.

## Test strategy

Phase 1 (TDD on `LoginComponent`):

1. Red: spec asserting the primary button DOM element carries `bg-brand`.
2. Green: re-theme login primary buttons.

Phase 2 (mechanical sweep):

- Re-theme the remaining 8 components in small batches, running the full
  test suite + lint after each batch.

## Verification

- `rg "bg-blue-600|text-blue-600" apps/frontend/src` must return zero matches.
- `rg "bg-blue-100|text-blue-800" apps/frontend/src` must still find the
  status-badge usages (expected).
- `npm run test --workspace=apps/frontend` -> clean.
- `npm run lint` -> clean.
