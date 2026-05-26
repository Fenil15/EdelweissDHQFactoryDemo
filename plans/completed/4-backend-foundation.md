# Plan: Backend foundation (issue #4)

## Summary

Adds the `apps/backend` workspace as the foundation for the vendor-onboarding
service. This slice intentionally ships only boilerplate + persistence wiring —
no auth, no upload, no domain endpoints. It exists so later slices (#5–#10)
can drop in routes and services against a real Postgres-backed DataSource.

## What ships

- **Workspace:** `apps/backend` (`@edelweiss/backend`), Node 20+, TypeScript
  strict (inherits `tsconfig.base.json`).
- **HTTP:** Express 4 with JSON body parsing.
  - `GET /api/health` → `{ "status": "ok" }`.
- **Persistence:** TypeORM 0.3 + `pg`, single `AppDataSource`
  (`postgres`, `synchronize: true`) reading `DATABASE_URL` from the env.
- **Entities** (all UUID PKs, `timestamptz` timestamps):
  - `User` — `email` (unique), `role` enum (`vendor|checker|admin`),
    OTP fields (`otpHash`, `otpExpiresAt`, `otpFailCount`, `lockedUntil`),
    `createdAt`/`updatedAt`.
  - `Vendor` — `@OneToOne` → User via `userId` (unique), optional `companyName`.
  - `Submission` — `@ManyToOne` → Vendor; `status` enum (`Draft`, `In-Process`,
    `Completed`, `Rejected`, `Modification-Required`, default `Draft`);
    `formDataJson` (jsonb, `{}`); `currentStep` (int, 1); timestamps.
  - `Document` — `@ManyToOne` → Submission; `fileName`, `mimeType`,
    `sizeBytes`, `storagePath`, `uploadedAt`.
  - `AuditLog` — `@ManyToOne` → Submission and User (actor); `action`,
    `fromStatus?`, `toStatus?`, `comments?`, `createdAt`. **Append-only**:
    no `updatedAt`, no `@UpdateDateColumn`.
- **App factory:** `createApp()` in `src/app.ts` builds the Express app
  without binding to a port — keeps tests fast and self-contained.
- **Boot:** `src/index.ts` loads `.env`, initializes the DataSource, mounts
  the app, and listens on `PORT` (default `3000`).

## Tests

- `__tests__/health.test.ts` — supertest hit against `/api/health`, no DB
  required. Confirmed green locally.
- `__tests__/db.integration.test.ts` — boots `AppDataSource`,
  `synchronize(true)` to reset schema, inserts a `User` + `Vendor`, reads
  back. Requires Postgres on `localhost:5432` with `edelweiss_test`
  database. **Could not run here:** the worktree has no Docker / Podman
  socket and no local Postgres. The test compiles and the only failure is
  `ECONNREFUSED` at connect time — it will pass in stage 6 once Postgres
  is available.

## How later slices consume this

- Auth/OTP work (#5) will add an `auth` router under `src/routes/auth/` and
  read `JWT_SECRET` from env; the `User` entity already carries OTP and
  lockout columns.
- Submission lifecycle (#7, #8) operates on `Submission` + `AuditLog` —
  the latter is the audit trail behind status transitions.
- Document upload (#6) writes to `STORAGE_DIR` and persists `Document`
  rows tied to a `Submission`.

## Deliberate non-goals

- No migrations: `synchronize: true` is intentional for the demo. Switching
  to migrations is a follow-up if/when this graduates beyond demo scope.
- No request validation, no error-handling middleware, no logger — added in
  later slices alongside the routes that need them.
- No CORS — the frontend slice (#9) will add it once the frontend exists.
- No root `package.json` changes: existing `--workspaces --if-present`
  scripts already pick up the new workspace, and backend-only deps live
  in `apps/backend/package.json`.
