> Source: issue #3
> Notion page: 36b876cd42cc80e08992c47564e48b41

# Repo scaffolding plan

This slice lays down the empty-house foundation for the Edelweiss vendor
onboarding monorepo. No application code is added — slices #4 and #5 scaffold
the backend and frontend workspaces on top of this baseline.

## What was implemented

- **npm workspaces** — Root `package.json` declares `"workspaces": ["apps/*"]`
  with delegating scripts (`dev`, `build`, `test`) that fan out via
  `--workspaces --if-present`. A `.gitkeep` placeholder keeps `apps/` real
  before any workspace exists.
- **Linting & formatting** — ESLint 9 flat config (`eslint.config.js`) wired
  with `@eslint/js` and `typescript-eslint`. The config scopes lint to
  `apps/**/*.ts` so the bare repo lints clean with `--max-warnings=0`.
  Prettier defaults: `singleQuote`, `semi`, `printWidth: 100`,
  `trailingComma: 'all'`. `.prettierignore` excludes generated/install dirs.
- **Pre-commit hook** — Husky v9 initialized via `npx husky init`; the
  `.husky/pre-commit` hook runs `npx lint-staged`. `lint-staged` config in
  `package.json` formats and fixes `*.{ts,js,json,md}` on staged files.
- **Editor & env hygiene** — `.editorconfig` (2-space, LF, UTF-8, final newline),
  `.gitignore` covering `node_modules/`, `dist/`, `build/`, `.env`, `.env.local`,
  `uploads/`, `coverage/`, `.DS_Store`, `*.log`, and `.env.example` documenting
  `DATABASE_URL`, `JWT_SECRET`, `STORAGE_DIR`, `PORT`.
- **Local Postgres** — `docker-compose.yml` with a single `db` service running
  `postgres:16-alpine` (user/password `postgres`, db `edelweiss`), exposing
  `5432:5432`, persisting to a named `pgdata` volume.
- **Docs & license** — `README.md` with the one-liner purpose and placeholder
  Setup / Local Dev / Tests / License sections. `LICENSE` declares the project
  UNLICENSED.
- **TypeScript base** — `tsconfig.base.json` at the root carries the shared
  strict + ES2022 + CommonJS compiler options that the backend workspace will
  extend in slice #4. (Angular frontend keeps its own tsconfig.)

## Why this shape

- Workspaces over a monorepo tool (Nx/Turborepo) keep the POC's surface area
  small and stay aligned with the PRD's "minimal infra" framing.
- ESLint scoped to `apps/**/*.ts` avoids false positives from config files and
  keeps the bare-repo lint clean — important so the smoke test (and CI later)
  can rely on `npm run lint` exiting 0 from day one.
- Husky + lint-staged is installed but only fires on files that exist in a
  commit, so the initial scaffolding commit is not blocked.

## Smoke checks performed

- `npm install` succeeded; lockfile generated.
- `npm run lint` exits 0 against the empty (no-`apps`) tree.
- `git status` shows only the intended files staged (Husky's generated
  `.husky/_/` is gitignored by husky itself).
