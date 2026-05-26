# Issue #9 — Submission state machine + maker-checker decisions + audit + email

> Source: issue 9
> Notion page: 36b876cd42cc80e08992c47564e48b41

## Scope

Backend only. Frontend visualization is #10. We expose two new endpoints and
extend the email service. Every state change writes an immutable AuditLog row.

## State machine

```
                +-----------------------------+
                |                             |
                v                             |
  Draft  ----> In-Process ----> Completed     |
                |                             |
                |--> Rejected                 |
                |                             |
                +--> Modification-Required ---+   (vendor re-submits)
```

Allowed transitions (and only these):

| From                  | To                    | Triggered by                                               |
| --------------------- | --------------------- | ---------------------------------------------------------- |
| Draft                 | In-Process            | POST /submit (vendor)                                      |
| Modification-Required | In-Process            | POST /submit (vendor) — resubmit                           |
| In-Process            | Completed             | POST /decision action=approve (checker/admin)              |
| In-Process            | Rejected              | POST /decision action=reject (checker/admin)               |
| In-Process            | Modification-Required | POST /decision action=request-modification (checker/admin) |

Any other transition is forbidden and surfaces as `409 invalid_transition`.

### Guards

- Submit (POST /submit):
  - status MUST be `Draft` or `Modification-Required`; else 409.
  - actor MUST be the owning vendor (Vendor.userId === actor.userId); else 404
    (mirrors the existing no-leak policy used by GET/PUT).
  - role MUST be `vendor`; else 403 (handled by route-level requireRole).
- Decision (POST /decision):
  - status MUST be `In-Process`; else 409.
  - role MUST be `checker` or `admin`; else 403.
  - body.action MUST be one of {`approve`, `reject`, `request-modification`}; else 400.
  - body.comments MUST be a non-empty string after trim; else 422 (per the
    orchestrator brief: "422 if comments empty").
  - target status is computed from action:
    - approve → Completed
    - reject → Rejected
    - request-modification → Modification-Required

## Endpoints

### POST /api/submissions/:id/submit

- Auth: JWT vendor only.
- 401 no token / 403 non-vendor / 404 not-owner-or-missing /
  409 status not in {Draft, Modification-Required}.
- 200 on success — body is the updated submission DTO.

Side effects on happy path (within the same DB transaction where reasonable):

1. Update submission.status to `In-Process`.
2. Insert AuditLog { submissionId, actorUserId, action: 'submit', fromStatus,
   toStatus: 'In-Process', comments: null }.
3. emailService.notifyCheckersOfNewSubmission(submission) — looks up all users
   with role=checker and console-logs an EMAIL line per checker.

### POST /api/submissions/:id/decision

- Auth: JWT checker or admin.
- Body: `{ action: 'approve' | 'reject' | 'request-modification', comments: string }`.
- 401 no token / 403 vendor or unknown role / 404 not found /
  409 status != In-Process / 400 unknown action / 422 empty comments.
- 200 on success — body is the updated submission DTO.

Side effects on happy path:

1. Update submission.status to mapped target.
2. Insert AuditLog { submissionId, actorUserId, action: <action>, fromStatus:
   'In-Process', toStatus, comments }.
3. emailService.notifyVendorOfDecision(submission, action, comments) — resolves
   the vendor's user email and console-logs an EMAIL line.

## AuditLog repository helper

New file: `apps/backend/src/services/audit-log.service.ts`.

```ts
export async function writeTransition(input: {
  submissionId: string;
  fromStatus: SubmissionStatus | null;
  toStatus: SubmissionStatus | null;
  actorUserId: string;
  action: string; // 'submit' | 'approve' | 'reject' | 'request-modification'
  comments?: string | null;
}): Promise<AuditLog>;
```

Always inserts a fresh row (no upsert). There is no `updateTransition` or
`deleteTransition` helper — the entity has no `updatedAt` column and we expose
no PATCH/DELETE on `/api/audit-logs` (we don't expose that resource at all in
this issue). Unit test will assert that inserting twice produces two distinct
rows with the original first row untouched.

## Email service extensions

Extend `apps/backend/src/services/email.service.ts` with:

```ts
notifyCheckersOfNewSubmission(submission: Submission): Promise<void>
notifyVendorOfDecision(
  submission: Submission,
  action: 'approve' | 'reject' | 'request-modification',
  comments: string,
): Promise<void>
```

Console log format (mirroring the existing `[EMAIL]` style):

```
[EMAIL] to=<email> subject=<...> body=<...>
```

Body must mention `submissionId`, the new `status`, and (for decisions) the
`comments`. Tests will spy on `console.log` and assert the printed string
contains those tokens.

`notifyCheckersOfNewSubmission` reads `User` where `role='checker'` and emits
one `[EMAIL]` line per checker. `notifyVendorOfDecision` resolves the vendor
(via submission.vendorId → Vendor.userId → User.email).

## State machine module

New file: `apps/backend/src/services/submission-state-machine.ts`. Pure
function:

```ts
export function nextStatus(
  current: SubmissionStatus,
  action: 'submit' | 'approve' | 'reject' | 'request-modification',
): SubmissionStatus; // throws InvalidTransitionError if not allowed
```

`InvalidTransitionError` is a simple `Error` subclass so route handlers can
catch and translate to 409.

## Test layout (TDD red→green→commit per slice)

1. `__tests__/audit-log.service.test.ts` — writeTransition inserts a row;
   second call inserts a second row; the first row is unchanged. No update
   API exposed.
2. `__tests__/submission-state-machine.test.ts` — allowed transitions return
   target; disallowed transitions throw InvalidTransitionError. Cover every
   pair we care about, including `Completed → submit` and
   `Draft → approve`.
3. `__tests__/submit-endpoint.test.ts` (or extend submissions.test.ts) —
   401 no auth, 403 non-vendor, 404 non-owner, 409 wrong status, 200 happy
   path. Asserts: status transitions, AuditLog row appears, checker emails
   logged. Also covers Modification-Required → In-Process resubmit.
4. `__tests__/decision-endpoint.test.ts` — 401/403/422/409/200 plus all
   three actions and per-action audit + email assertions.
5. Email format assertions piggyback on the above suites via
   `jest.spyOn(console, 'log')`.

## Out of scope

- Any frontend UI/UX (deferred to #10).
- An `/api/audit-logs` listing endpoint (not required by issue #9).
- Email retry / queue / templating; the console-mock is intentionally trivial.
