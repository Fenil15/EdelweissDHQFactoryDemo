# Issue #5 — Frontend foundation (Angular + Tailwind + routing shell + healthcheck UI)

## Goal

Bootstrap `apps/frontend` as an Angular workspace with Tailwind, dev proxy to
the backend, base routes (login, vendor/checker dashboards, audit-log shells),
Jest unit-test runner, and a landing page that calls `/api/health` to prove
end-to-end wiring with the backend.

## Approach

1. Scaffolded the Angular workspace via `npx @angular/cli ng new frontend
--directory=apps/frontend --routing=true --style=css --skip-git --skip-install
--standalone --strict --package-manager=npm`. Removed the auto-generated
   `apps/frontend/README.md` (root already has one) so it doesn't pollute the
   repo.
2. Replaced the generated `package.json` so the workspace is named
   `@edelweiss/frontend` and exposes the project scripts the rest of the
   monorepo expects (`dev`, `build`, `test`, `lint`). Dev script proxies
   `/api/*` to `http://localhost:3000` via `proxy.conf.json`.
3. Added Tailwind 3 with `tailwind.config.js` + `postcss.config.js` and wired
   `@tailwind base/components/utilities` into `src/styles.css`.
4. Configured Jest as the unit-test runner:
   - Added `@angular-builders/jest` to `devDependencies` and switched the
     `test.builder` in `angular.json` to `@angular-builders/jest:run`.
   - Added `jest.config.js`, `setup-jest.ts`, updated `tsconfig.spec.json` to
     emit CommonJs and type against `jest` instead of vitest.
   - Angular 21 ships zoneless by default, so `setup-jest.ts` calls
     `setupZonelessTestEnv()` from `jest-preset-angular/setup-env/zoneless`
     (the older `setup-jest` entry no longer exists in v16).
5. Set up routing in `src/app/app.routes.ts` using lazy-loaded standalone
   components for `/login`, `/vendor`, `/checker`, `/audit`, plus a
   `HomeComponent` at `/` and a wildcard redirect.
6. Made `HomeComponent` standalone, injected `HttpClient` (registered via
   `provideHttpClient(withFetch())` in `app.config.ts`), and rendered a
   Tailwind-styled landing page that calls `GET /api/health` on init and shows
   the response status in a `[data-testid="health-status"]` span. The status
   is stored in a signal so the template stays reactive without tripping
   `ExpressionChangedAfterItHasBeenCheckedError` in zoneless mode.
7. Added `src/app/pages/home/home.component.spec.ts` using
   `provideHttpClientTesting()` + `HttpTestingController` to assert the
   rendered status text after flushing a mocked `/api/health` response.
8. Updated root `.gitignore` to also ignore `.angular/`.

## Files added

- `apps/frontend/angular.json` (Jest builder)
- `apps/frontend/package.json` (`@edelweiss/frontend`)
- `apps/frontend/proxy.conf.json`
- `apps/frontend/tailwind.config.js`
- `apps/frontend/postcss.config.js`
- `apps/frontend/jest.config.js`
- `apps/frontend/setup-jest.ts`
- `apps/frontend/tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`
- `apps/frontend/src/main.ts`, `src/index.html`, `src/styles.css`
- `apps/frontend/src/app/app.ts`, `app.html`, `app.css`, `app.config.ts`, `app.routes.ts`
- `apps/frontend/src/app/pages/home/home.component.{ts,html,spec.ts}`
- `apps/frontend/src/app/pages/login/login.component.ts`
- `apps/frontend/src/app/pages/vendor-dashboard/vendor-dashboard.component.ts`
- `apps/frontend/src/app/pages/checker-dashboard/checker-dashboard.component.ts`
- `apps/frontend/src/app/pages/audit-log/audit-log.component.ts`

## Validation

- `npm install` at repo root (refreshes workspaces, updates lockfile).
- `cd apps/frontend && npm run build` — succeeds; produces lazy chunks for each
  page component.
- `cd apps/frontend && npm test` — `HomeComponent renders backend status from
/api/health` passes.
- `npm run lint` at repo root — clean (root ESLint scope is `apps/**/*.ts`).

## Acceptance criteria coverage

- [x] `apps/frontend` Angular workspace generated via CLI conventions.
- [x] Tailwind installed and wired into `styles.css`.
- [x] `proxy.conf.json` proxies `/api/*` to backend (`:3000`).
- [x] Routes for `/login`, `/vendor`, `/checker`, `/audit` shells.
- [x] Landing page hits `/api/health` on init and renders the backend status.
- [x] `@angular-builders/jest` configured; `npm test` runs Jest.
- [x] Jest spec mocks HttpClient and asserts the rendered status text.

## Out of scope (per task constraints)

- Auth/login flow, forms, business logic — all placeholders.
- Backend changes (`apps/backend/`) — owned by issue #4.
