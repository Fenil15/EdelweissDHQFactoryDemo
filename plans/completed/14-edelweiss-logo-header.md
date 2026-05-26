# Issue #14 — Edelweiss logo in global top header

> Source: issue #14
> Notion page: 36c876cd42cc8009aa62d42bc93db05d

## Goal

Foundational slice of the Edelweiss-branding feature. Lands the logo asset,
adds a persistent top-header element to the app shell, and exposes a
`brand` Tailwind color token. This slice deliberately does NOT touch any
existing `bg-blue-600` / `text-blue-600` usages — that sweep is the sibling
slice #15.

## Tracer-bullet plan

1. **Branch** off `feat/vendor-onboarding-collect` →
   `feat/edelweiss-logo-header`.

2. **Behavior A — header with logo (TDD red→green)**
   - Red: add `apps/frontend/src/app/app.spec.ts` that mounts `App`,
     waits for change-detection, and asserts the rendered DOM contains a
     `<header>` with a child `<img>` whose `alt` is "Edelweiss"
     (case-insensitive contains). Run the spec, confirm it fails for the
     right reason (no `<header>` yet). Commit:
     `test: failing spec for global Edelweiss header`.
   - Green: copy
     `/var/dhqfactory/repos/edelweiss-demo/async-jobs/36c876cd42cc8009aa62d42bc93db05d/edelweiss-logo.png`
     to `apps/frontend/public/edelweiss-logo.png`, then add a `<header>`
     above `<router-outlet>` in `apps/frontend/src/app/app.html` with a
     white background, thin bottom border (`border-b border-gray-200`),
     a centered max-width container, and
     `<img src="/edelweiss-logo.png" alt="Edelweiss" class="h-10 w-auto">`.
     Run the full test suite + lint. Commit:
     `feat: add global Edelweiss top header with logo`.

3. **Behavior B — Tailwind `brand` color token (config-only)**
   - Extend `apps/frontend/tailwind.config.js` from
     `theme: { extend: {} }` to
     `theme: { extend: { colors: { brand: { DEFAULT: '#254AA5', dark: '#1d3d8a' } } } }`.
   - Run lint + tests to make sure nothing else broke. Commit:
     `feat: add brand color token (#254AA5) to Tailwind`.

4. **Push** `feat/edelweiss-logo-header` to origin.

## Explicitly out of scope (sibling slice #15)

- Replacing any existing `bg-blue-600` / `text-blue-600` occurrences with
  `bg-brand` / `text-brand`.
- Modifying `StatusBadgeComponent` or any other branded component.

## Acceptance checks before push

- `npm run test --workspace @edelweiss/frontend` passes (the workspace
  surfaces `test` only; the issue text mentions `test:run`, which does not
  exist in this repo — use `test`).
- `npm run lint` passes from the repo root.
- `apps/frontend/public/edelweiss-logo.png` exists (~7.7 KB).
- `apps/frontend/src/app/app.html` has `<header>` before `<router-outlet>`
  with an `<img alt="Edelweiss">`.
- `apps/frontend/tailwind.config.js` exposes
  `theme.extend.colors.brand = { DEFAULT: '#254AA5', dark: '#1d3d8a' }`.
- No diff in any file containing `bg-blue-600` / `text-blue-600`.
