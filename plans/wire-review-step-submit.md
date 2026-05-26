> Source: issue 19
> Notion page: 36c876cd42cc80b3ab55f3d95a6e6bae

# Wire Review-step Submit: service.submitDraft + component CTA

## Goal

Hook up the Review-step CTA on the vendor onboarding form so vendors can actually submit their draft. The backend endpoint (`POST /api/submissions/:id/submit`) already exists; we just need the frontend service method and the component branch.

## Tracer-bullet TDD phases

Each phase is one red-green pair (failing test → minimal implementation → commit each). After all pairs we do a refactor pass.

### Phase 1 — Service: `submitDraft(id)`

Red: in `apps/frontend/src/app/core/submission/submission.service.spec.ts`, add a test asserting that `service.submitDraft('s1').subscribe()` issues a `POST` to `/api/submissions/s1/submit` with an empty body, mirroring the `createDraft` test.

Green: in `apps/frontend/src/app/core/submission/submission.service.ts`, add `submitDraft(id: string): Observable<Submission>` that returns `this.http.post<Submission>(\`/api/submissions/${id}/submit\`, {})`.

### Phase 2 — Component: CTA label "Submit" on Review

Red: in `submission-form.component.spec.ts`, add a test that drives the form forward to the review step (or otherwise positions it on step 7) and asserts the `next-btn` button text is "Submit". Also a sibling test that the button reads "Next" on step 1.

Green: introduce a `ctaLabel` computed (or inline ternary) that returns `'Submit'` when `currentKey() === 'review'`, else `'Next'`. Bind the template button content to it.

### Phase 3 — Component: clicking Submit calls service + navigates to `/vendor`

Red: navigate to review step, click `next-btn`, expect a `POST /api/submissions/s1/submit` to be issued (use `HttpTestingController.expectOne` with method + url filter). After `req.flush(...)`, expect `router.navigate` (spied on or via real router) to have been called with `['/vendor']`.

Green: in `submission-form.component.ts`, change the click handler to a new method `onPrimaryAction()` (or branch inside `goNext`) — when `currentKey() === 'review'`, call `this.submissions.submitDraft(this.submissionId).subscribe({ next: () => this.router.navigateByUrl('/vendor'), error: ... })`; otherwise fall through to `goNext()`.

### Phase 4 — Component: error path

Red: simulate submit, then `req.flush(null, { status: 500, statusText: 'Server Error' })`. Expect (a) an inline error element with `text-red-600` class to appear on the review step, and (b) the button to be re-enabled (not disabled).

Green: add a `submitError = signal<string | null>(null)` and `submitting = signal(false)`. In the error callback set `submitError.set('Could not submit. Please try again.')` and `submitting.set(false)`. Add inline span with `text-red-600` shown via `@if (submitError())` on the review step.

### Phase 5 — Component: in-flight disable + null-id disable

Red: at the review step, click submit and BEFORE flushing the response, assert `next-btn` is disabled. Separately, render the form with route id = null and step set to review, assert the button is disabled.

Green: update `canAdvance()` (or the `[disabled]` binding) so on review:
- disabled when `submitting()` is true, OR
- disabled when `submissionId` is null.

### Phase 6 — Refactor

After all phases pass, review the click handler, naming, and template branching for clarity. If the `goNext()` method ended up split, consider extracting a `submitReview()` method to keep `goNext` focused on step advancement. Run full test suite + lint.

## Files to touch

- `apps/frontend/src/app/core/submission/submission.service.ts` (add `submitDraft`)
- `apps/frontend/src/app/core/submission/submission.service.spec.ts` (add test)
- `apps/frontend/src/app/pages/submission-form/submission-form.component.ts` (CTA label, click branch, error/inflight signals, disabled rules)
- `apps/frontend/src/app/pages/submission-form/submission-form.component.spec.ts` (add tests)

Backend (`apps/backend/src/routes/submissions.ts`) is NOT modified.

## Commands

- Run single test file: `npm test -w @edelweiss/frontend -- --testPathPatterns=submission.service`
- Run frontend tests: `npm test -w @edelweiss/frontend`
- Lint: `npm run lint`

## Commit convention

Each commit:
```
<type>: <short description>

Implements: #19

Co-Authored-By: DHQ Factory <fenil@dronahq.com>
```
