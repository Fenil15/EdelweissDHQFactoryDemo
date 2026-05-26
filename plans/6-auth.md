# Plan: Auth — invitation + email OTP + JWT + RBAC

> Source: issue #6
> Notion page: 36b876cd42cc80e08992c47564e48b41

## Goals

Implement passwordless auth: admin invites users by email; users log in with a
6-digit OTP delivered via a mock email sender (console.log). Successful OTP
verification yields a 24h JWT containing `{ userId, role }`. Backend exposes
JWT middleware + a `requireRole` RBAC guard. Frontend has a `/login` flow that
collects email then OTP, stores the JWT, and redirects to the role-appropriate
dashboard (`/vendor`, `/checker`, `/admin`). A route guard kicks unauthenticated
users back to `/login`, and an HTTP interceptor attaches the JWT to outgoing
requests.

## Constraints / notes

- User entity (from #4) already has `otpHash`, `otpExpiresAt`, `otpFailCount`,
  `lockedUntil`. Need to add `invitationToken` (nullable).
- Schema is managed by `synchronize: true` — no migration files needed.
- 3-fail lockout = 5 min; OTP TTL = 10 min; JWT TTL = 24h.
- Mock email = `console.log('[EMAIL] To: ... OTP: ...')`. No SMTP.
- Backend tests: Jest + supertest hitting `createApp()`, real Postgres DB via
  `DATABASE_URL` (already wired in `.env.test`). Use `AppDataSource.synchronize(true)`
  in `beforeEach` to reset.
- Frontend tests: Angular Jest + `HttpTestingController` (already used in
  `HomeComponent` spec). For route guard / interceptor, exercise via TestBed.
- POC posture — keep services small, no DI container needed beyond what's there.

## Phases

1. Backend: extend `User` entity with `invitationToken` (nullable varchar).
   `synchronize:true` picks it up automatically.
2. Backend: add `MockEmailSender` service that logs `[EMAIL] To:<email> ...` to
   console. Single function, no class needed beyond a small object.
3. Backend: `POST /api/auth/invite` — admin-only, JWT-protected. Creates the
   User row with `{ email, role }` and a random `invitationToken`. Logs the
   token via mock email. (RBAC guard depends on JWT middleware; implement guard
   stub here so this route can mount.)
4. Backend: `POST /api/auth/request-otp` — generates 6-digit OTP, hashes it
   (sha256 is fine for POC), stores hash + 10-min expiry, resets fail count,
   logs OTP to console. Returns `{ ok: true }` (no enumeration of unknown
   emails — just always 200).
5. Backend: `POST /api/auth/verify-otp` — validates OTP. On mismatch, increment
   fail count; at 3 set `lockedUntil = now+5min`. While `lockedUntil > now`,
   return 423. On success, clear OTP fields and return a signed JWT
   (`{ userId, role }`, 24h).
6. Backend: JWT middleware (extracts `Authorization: Bearer ...` into
   `req.user`) and `requireRole(...roles)` factory. Wire `requireRole('admin')`
   onto the invite route.
7. Frontend: `AuthService` — methods `requestOtp(email)`, `verifyOtp(email, otp)`,
   `invite(email, role)`. Token stored in `localStorage` under `auth.token`.
   Exposes `token()`, `roleFromToken()`, `logout()`.
8. Frontend: `authInterceptor` (functional) — attaches `Authorization: Bearer
<token>` when a token exists.
9. Frontend: `authGuard` (functional `CanActivateFn`) — if no token, redirect to
   `/login`. Apply to `vendor`, `checker`, `admin` routes.
10. Frontend: `LoginComponent` — reactive-form-free, signal-based two-step UI:
    enter email → enter OTP → submit. On success, decode role from JWT and
    `router.navigateByUrl('/' + role)`.
11. Frontend: register interceptor in `app.config.ts`, add `admin` route stub +
    guards on protected routes. Jest test for the login flow asserts redirect
    by role.

## TDD slices

Phases 4, 5, 6 get strict red-green TDD (the auth logic). Phases 1, 2, 3, 7-11
are pragmatic: one happy-path test per layer where the existing infrastructure
already supports it; pure wiring (route mounting, interceptor registration in
app.config) is committed directly.
