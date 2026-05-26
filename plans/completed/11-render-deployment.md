> Source: issue 11
> Notion page: 36b876cd42cc80e08992c47564e48b41

# Plan — Issue #11: Render deployment + Dockerfiles + extended docker-compose + README

## Goal

Make the POC reproducibly runnable in two ways:

1. **Local one-shot** — `docker compose up --build` brings up Postgres, the Express backend, and the Angular frontend (served by nginx). The landing page reaches the backend `/api/health` and shows OK.
2. **Render Blueprint** — `render.yaml` at the repo root provisions a managed Postgres, a backend web service, and a frontend static site. A single "New Blueprint" click on Render works end-to-end.

This slice touches **infra/config only**; no application logic changes.

## Constraints / context

- npm-workspaces monorepo (`apps/backend`, `apps/frontend`).
- Backend: Express + TypeORM + Postgres, builds with `tsc` to `dist/`, entrypoint `dist/index.js`. Listens on `PORT` (default 3000). Reads `DATABASE_URL`, `JWT_SECRET`, `STORAGE_DIR`, `PORT` from env.
- Backend stores uploads on local FS at `STORAGE_DIR` (default `./uploads`). On Render this needs a writable path — use `/data/uploads` (Render disk) or `/tmp/uploads` (ephemeral, acceptable for POC).
- Frontend: Angular 21 (`@angular/build`). Production build outputs to `dist/frontend/browser/` (Angular's new default with `@angular/build:application`).
- Frontend dev server already proxies `/api` → `http://localhost:3000` via `proxy.conf.json`. In compose/prod, nginx must serve the SPA AND proxy `/api/*` to the backend.
- Existing root `docker-compose.yml` only defines `db`. We will extend it; do not break the existing `npm run dev` workflow where the db service alone is needed.

## Files to create / modify

### 1. `apps/backend/Dockerfile` (new)

Multi-stage, built from the repo root (so npm workspaces resolve):

- Stage `deps`: `node:20-alpine`, copy root `package.json`, `package-lock.json`, `apps/backend/package.json`, `apps/frontend/package.json` (workspace lockfile requires both manifests), run `npm ci`.
- Stage `build`: copy `deps` `node_modules`, copy `tsconfig.base.json`, `apps/backend/tsconfig.json`, `apps/backend/src`, run `npm run build --workspace=apps/backend`.
- Stage `runtime`: `node:20-alpine`, `WORKDIR /app`, copy `package.json`/`package-lock.json`/workspace manifests, run `npm ci --omit=dev --workspaces --include-workspace-root=false` (or simpler: `npm ci --omit=dev`), copy `apps/backend/dist` → `/app/apps/backend/dist`, set `NODE_ENV=production`, `STORAGE_DIR=/data/uploads`, `PORT=3000`, `EXPOSE 3000`, `CMD ["node", "apps/backend/dist/index.js"]`.

### 2. `apps/frontend/Dockerfile` (new)

Multi-stage, also built from repo root:

- Stage `deps`: `node:20-alpine`, `npm ci` at the workspace root.
- Stage `build`: copy source, run `npm run build --workspace=apps/frontend -- --configuration=production`. Angular output lands at `/build/apps/frontend/dist/frontend/browser`.
- Stage `runtime`: `nginx:alpine`, copy `dist/frontend/browser` → `/usr/share/nginx/html`, copy `nginx.conf` → `/etc/nginx/conf.d/default.conf`, `EXPOSE 80`.

### 3. `apps/frontend/nginx.conf` (new)

Single `server { listen 80; ... }`:

- `root /usr/share/nginx/html;`
- `index index.html;`
- `location /api/ { proxy_pass http://backend:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }`
- `location / { try_files $uri $uri/ /index.html; }`
- Gzip on for text assets.

### 4. `docker-compose.yml` (modified)

Add `backend` and `frontend` services to the existing `db`:

- `backend`:
  - `build: { context: ., dockerfile: apps/backend/Dockerfile }`
  - `environment`: `DATABASE_URL=postgres://postgres:postgres@db:5432/edelweiss`, `JWT_SECRET=local-dev-secret`, `STORAGE_DIR=/data/uploads`, `PORT=3000`
  - `volumes: ['uploads:/data/uploads']`
  - `depends_on: [db]`
  - `ports: ['3000:3000']`
  - `restart: unless-stopped`
- `frontend`:
  - `build: { context: ., dockerfile: apps/frontend/Dockerfile }`
  - `depends_on: [backend]`
  - `ports: ['8080:80']`
  - `restart: unless-stopped`
- `volumes:` add `uploads:`.

(Issue spec says frontend exposes 8080 — keep that.)

### 5. `.dockerignore` at repo root (new)

Exclude `node_modules`, `**/node_modules`, `**/dist`, `**/.git`, `**/.env*` (except example), `logs`, `plans`, `.claude` to keep image context small and avoid leaking secrets.

### 6. `render.yaml` (new) — Blueprint at repo root

Spec (Render's blueprint schema):

```yaml
databases:
  - name: edelweiss-db
    plan: free
    databaseName: edelweiss
    user: edelweiss

services:
  - type: web
    name: edelweiss-backend
    runtime: node
    plan: free
    buildCommand: npm ci && npm run build --workspace=apps/backend
    startCommand: node apps/backend/dist/index.js
    healthCheckPath: /api/health
    envVars:
      - key: NODE_VERSION
        value: '20'
      - key: DATABASE_URL
        fromDatabase:
          name: edelweiss-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: STORAGE_DIR
        value: /tmp/uploads
      - key: PORT
        value: '10000'

  - type: web
    name: edelweiss-frontend
    runtime: static
    buildCommand: npm ci && npm run build --workspace=apps/frontend -- --configuration=production
    staticPublishPath: apps/frontend/dist/frontend/browser
    pullRequestPreviewsEnabled: false
    routes:
      - type: rewrite
        source: /api/*
        destination: https://edelweiss-backend.onrender.com/api/*
      - type: rewrite
        source: /*
        destination: /index.html
```

Notes:

- Render's Node runtime sets `PORT` automatically; we keep `process.env.PORT ?? 3000` working.
- Static site rewrite to backend's `*.onrender.com` is the pragmatic POC posture (service URL is predictable from name). We document this assumption in the README so the user can adjust if Render generates a different hostname.
- Free Postgres tier is fine for POC; user can switch to starter.

### 7. `README.md` (modified)

Add new sections per acceptance criteria:

- **Prerequisites**: Node 20 LTS, npm, Docker (for compose path), a Render account (for deploy).
- **Local Dev (docker compose up)**: clone → `docker compose up --build` → frontend at `http://localhost:8080`, backend at `http://localhost:3000/api/health`, db at `localhost:5432`. Mention `synchronize: true` auto-creates schema; how to seed an admin user (point to `npm run dev` path for now since there's no seed script in this slice).
- **Manual Dev (npm install + npm run dev)**: keep / refresh existing text.
- **Tests**: `npm test` runs both workspaces.
- **Environment Variables**: table of `DATABASE_URL`, `JWT_SECRET`, `STORAGE_DIR`, `PORT` — what each does, defaults, where they're consumed.
- **Render Deployment**: connect repo → New Blueprint → point at `render.yaml` → on first deploy, fix the frontend `destination` URL if Render assigned a different backend hostname → set `JWT_SECRET` (auto-generated) and confirm `DATABASE_URL` wired from managed DB.

## Verification (no Docker CLI available)

- Visually re-read each Dockerfile, confirm every `COPY` path exists in the repo.
- `npm run lint --workspaces` clean.
- `npm run build --workspace=apps/backend` produces `apps/backend/dist/index.js`.
- `npm run build --workspace=apps/frontend -- --configuration=production` produces `apps/frontend/dist/frontend/browser/index.html`.
- `npm test --workspaces` still green.
- `render.yaml` parses as valid YAML (visual review against Render's blueprint reference).

## Commit grouping

1. `chore: add backend multi-stage Dockerfile + .dockerignore`
2. `chore: add frontend multi-stage Dockerfile + nginx.conf`
3. `chore: extend docker-compose with backend + frontend services`
4. `chore: add render.yaml Blueprint`
5. `docs: README local Docker + Render deployment sections`

All commits include `Implements: #11` and `Co-Authored-By: DHQ Factory <fenil@dronahq.com>`.

## Out of scope

- Backend seed scripts / Postgres init data — not in this issue.
- CI workflow (.github/workflows) — not in this issue.
- Production hardening (HTTPS termination, non-root container user) — POC posture, mention briefly in README.
