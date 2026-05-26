# Plan: Checker dashboard + vendor status view + audit log viewer

> Source: issue 10
> Notion page: 36b876cd42cc80e08992c47564e48b41

## Goals

Bring the workflow UI together end-to-end:

- **Checker dashboard (`/checker`)**: table of all submissions across vendors,
  with filters by status (multi), date range, vendor-name text search and
  submission-id text search. Default view = `In-Process`. Toggle for "All
  statuses".
- **Checker submission detail (`/checker/:id`)**: read-only render of the form
  payload + attached documents + decision panel with three buttons (Approve /
  Reject / Request Modification) and a mandatory Comments textarea. Submit is
  disabled when comments are empty; calls `POST /api/submissions/:id/decision`.
- **Vendor dashboard upgrade (`/vendor`)**: list now shows _all_ the vendor's
  submissions (not only Drafts) with status badges (Draft, In-Process,
  Completed, Rejected, Modification-Required), color-coded. Each row links to a
  per-submission timeline.
- **Vendor submission timeline (`/vendor/submissions/:id/timeline`)**: shows
  the AuditLog entries (status changes with timestamps + comments) for that
  submission, in chronological order.
- **Admin audit log page (`/audit`)**: paginated/filterable AuditLog table.
  Admin-only via RBAC route guard.

## Constraints / notes

- Backend already exposes `POST /api/submissions/:id/decision` (#9) with the
  422 "comments_required" guard. We add list/audit endpoints around it.
- AuditLog entity already exists from #4. We expose it through new endpoints.
- Frontend `authGuard` exists but is role-agnostic. We add a `roleGuard`
  factory (or a thin wrapper) so `/audit` is admin-only and `/checker*` is
  checker-or-admin only. Keep this minimal — read `roleFromToken()` and
  redirect to `/` if mismatched.
- RBAC on the API: vendor sees only their own submissions / audit entries;
  checker/admin sees all.
- Frontend lazy-loaded standalone components, consistent with the rest of the
  app. Tailwind classes already available.

## Backend additions

### `GET /api/submissions` — role-aware

- Today this only handles `vendor` role (own submissions). Extend so that
  `checker` and `admin` can also hit it.
- For `checker`/`admin`: returns submissions across **all** vendors. Supports
  query params:
  - `status=<SubmissionStatus>` (single, repeatable via comma-split or
    multiple `status=` params). Keep the parsing simple — we'll accept
    `?status=In-Process,Draft` and split.
  - `vendorName=<substring>` — case-insensitive contains match against
    `Vendor.companyName`.
  - `submissionId=<substring>` — case-insensitive contains match on
    `Submission.id` cast to text.
  - `dateFrom`, `dateTo` — ISO-8601, filter on `Submission.createdAt`.
- Response shape stays the same as today, plus an optional `vendorName` field
  per row so the checker UI can render the column without an N+1 fetch.
- For `vendor` role: existing behavior unchanged (still scoped to self,
  still ignores the cross-vendor filters silently).

### `GET /api/submissions/:id` — role-aware

- Today vendor-only. Extend so `checker`/`admin` can also read any submission
  (returns the serialized row). For `vendor`, existing ownership check stays.

### `GET /api/submissions/:id/audit`

- New endpoint. Returns the audit-log entries for a single submission in
  chronological order (`createdAt ASC`).
- RBAC: vendor must own the submission (else 404); checker/admin allowed on
  any.
- Response: `[{ id, action, fromStatus, toStatus, comments, actorUserId,
actorEmail, createdAt }]`. We include `actorEmail` so the UI can show "who"
  without an extra round-trip.

### `GET /api/audit-logs` (admin-only)

- New endpoint. Returns audit-log rows with optional filters:
  - `submissionId=<uuid>`
  - `action=<submit|approve|reject|request-modification>`
  - `actorEmail=<substring>` (case-insensitive contains)
  - `dateFrom`, `dateTo` (ISO-8601 against `createdAt`)
- Pagination: `?limit=<N, default 50, max 200>` + `offset=<N, default 0>`.
- RBAC: 403 for non-admin.
- Response: `{ rows: [...], total: <N> }` where each row is the same shape as
  `/api/submissions/:id/audit`, but additionally includes `submissionId`.

## Frontend additions

### Services

- Extend `SubmissionService`:
  - `list(filters)` — generic GET to `/api/submissions` taking optional
    `status[]`, `vendorName`, `submissionId`, `dateFrom`, `dateTo`.
  - `getById(id)` — GET `/api/submissions/:id` (checker-side use).
  - `submitDecision(id, action, comments)` — POST
    `/api/submissions/:id/decision`.
  - `getAuditTrail(id)` — GET `/api/submissions/:id/audit`.

- New `AuditLogService`:
  - `list(filters)` — GET `/api/audit-logs` with the supported filters +
    pagination.

### Pages

- `apps/frontend/src/app/pages/checker-dashboard/checker-dashboard.component.ts`:
  - Filter row: status multi-select, date range inputs, vendor-name text
    input, submission-id text input. Reset button.
  - Default-filter: status = `In-Process`. "All statuses" toggle clears the
    status filter.
  - Table with columns: Submission ID, Vendor Name, Submitted At, Status.
  - Each row links to `/checker/:id`.

- `apps/frontend/src/app/pages/checker-submission-detail/checker-submission-detail.component.ts`:
  - Loads submission + documents.
  - Renders the submission `formDataJson` in a read-only section (collapsible
    JSON / labeled values is fine for POC — we just need the data visible).
  - Documents list with download links (uses existing `DocumentService`).
  - Decision panel:
    - 3 buttons (Approve / Reject / Request Modification) — clicking one
      selects an action.
    - Comments textarea — required.
    - Submit button enabled only when (a) an action is selected and (b)
      comments are non-empty/non-whitespace.
    - On submit: call `submitDecision`, show success state, refresh the
      submission row.

- Update `apps/frontend/src/app/pages/vendor-dashboard/vendor-dashboard.component.ts`:
  - Switch from `listDrafts()` to `list({})` (vendor scope returns all the
    vendor's own submissions).
  - Render rows with a `<app-status-badge>` and a link to
    `/vendor/submissions/:id/timeline`.
  - Keep "Resume" link for `Draft` and `Modification-Required` rows pointing
    at `/vendor/submissions/:id` (the existing edit screen).

- `apps/frontend/src/app/pages/submission-timeline/submission-timeline.component.ts`:
  - Loads `getAuditTrail(id)` and renders entries in order: timestamp, action
    label, status transition (`fromStatus → toStatus`), comments,
    `actorEmail`.

- `apps/frontend/src/app/pages/audit-log/audit-log.component.ts`:
  - Filters: submissionId text, action dropdown, actorEmail text, date range.
  - Paginated table with `Previous` / `Next` buttons over `offset`/`limit`.
  - Columns: Created At, Action, From → To, Submission ID, Actor, Comments.

### Shared

- `apps/frontend/src/app/shared/status-badge/status-badge.component.ts`:
  small standalone component that renders a Tailwind pill with a color per
  `SubmissionStatus`. Inputs: `status`.

### Routing

- Replace `app.routes.ts` `/audit` route to apply an admin role guard, add
  `/checker/:id` and `/vendor/submissions/:id/timeline` routes, and gate
  `/checker*` with a checker-or-admin role guard. Add a tiny `roleGuard`
  helper in `core/auth/`.

## TDD slices (red → green)

### Backend

1. `GET /api/submissions` as a checker returns rows across all vendors with
   `vendorName` populated, default filter applies status filter when given.
2. `GET /api/submissions` as a checker honors `vendorName` substring filter.
3. `GET /api/submissions` as a checker honors `submissionId` substring filter
   and `dateFrom`/`dateTo` range.
4. `GET /api/submissions` as a vendor still scoped to own submissions
   (regression).
5. `GET /api/submissions/:id` as a checker returns any submission.
6. `GET /api/submissions/:id/audit` as the owning vendor returns chronological
   entries; another vendor gets 404.
7. `GET /api/submissions/:id/audit` as a checker returns entries for any
   submission, including `actorEmail`.
8. `GET /api/audit-logs` requires admin (vendor=403, checker=403).
9. `GET /api/audit-logs` filters by `submissionId`, `action`, `actorEmail`,
   `dateFrom`/`dateTo` and supports `limit`/`offset` pagination.

### Frontend

10. Extended `SubmissionService.list({...})` builds the right query string
    (status multi, vendorName, submissionId, dateFrom/dateTo).
11. `SubmissionService.submitDecision` POSTs the right body to
    `/api/submissions/:id/decision`.
12. `SubmissionService.getAuditTrail` GETs `/api/submissions/:id/audit`.
13. `AuditLogService.list` GETs `/api/audit-logs` with filters.
14. `CheckerDashboardComponent` renders rows from the service, applies the
    default `In-Process` filter on load and refreshes when filter changes.
15. `CheckerSubmissionDetailComponent`: submit button is disabled until both
    an action is selected and comments are non-empty.
16. `CheckerSubmissionDetailComponent`: clicking submit posts the right
    decision body, then shows a success indicator.
17. `VendorDashboardComponent` renders status badges per row (one assertion
    per status colour class).
18. `VendorDashboardComponent` link routes to the timeline path for the row.
19. `SubmissionTimelineComponent` renders the entries returned by the service
    in chronological order.
20. `AuditLogComponent` (admin) renders rows + paginates via the `Next` /
    `Previous` buttons.
21. `roleGuard` redirects when current JWT role is not in allowed set.

## Out of scope

- Admin-only restriction at the API level for `GET /api/audit-logs` is
  enforced, but a richer audit-event entity (object_type, ip, user-agent)
  remains out — we keep the existing AuditLog shape.
- Real-time updates / websockets — no.
- CSV export of audit logs — no.
- Server-side sorting flexibility — not needed for POC.
