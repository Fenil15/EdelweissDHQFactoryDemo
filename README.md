# edelweiss-demo

Edelweiss vendor onboarding — fullstack POC.

This repository is an npm-workspaces monorepo:

- `apps/backend` — Express + TypeORM (Postgres) REST API.
- `apps/frontend` — Angular 21 SPA (served by nginx in containers).

## Prerequisites

- Node.js 20 LTS and npm.
- Docker (only required for the `docker compose` workflow and to build images locally).
- A Render.com account (only required for the cloud deploy walkthrough).

## Local Dev — Docker Compose (recommended)

One-shot bring-up of Postgres + backend + frontend:

```sh
docker compose up --build
```

URLs once everything is healthy:

| Service  | URL                                  |
| -------- | ------------------------------------ |
| Frontend | http://localhost:8080                |
| Backend  | http://localhost:3000/api/health     |
| Postgres | `postgres://postgres:postgres@localhost:5432/edelweiss` |

Notes:

- The backend uses `synchronize: true` (POC posture), so TypeORM creates/updates
  the schema on first boot. No migrations to run.
- Uploaded documents persist in the `uploads` named volume
  (`docker volume inspect edelweiss-demo_uploads`).
- The frontend container's nginx proxies `/api/*` to the `backend` service on
  the internal compose network, so all requests are same-origin in the browser.

Stop and wipe state:

```sh
docker compose down -v
```

## Manual Dev — npm install + npm run dev

If you'd rather run the apps directly on the host:

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env` and adjust values.
3. Start Postgres only via Docker: `docker compose up -d db`.
4. Run both workspaces in dev mode: `npm run dev`.

The Angular dev server (on `:4200`) proxies `/api` to
`http://localhost:3000` via `apps/frontend/proxy.conf.json`.

## Tests

```sh
npm test
```

Delegates to each workspace's `test` script (Jest for both backend and
frontend).

## Environment Variables

| Variable       | Where used         | Default (dev)                                                | Purpose                                                         |
| -------------- | ------------------ | ------------------------------------------------------------ | --------------------------------------------------------------- |
| `DATABASE_URL` | backend            | `postgres://postgres:postgres@localhost:5432/edelweiss`      | TypeORM connection string.                                      |
| `JWT_SECRET`   | backend            | `change-me-in-production`                                    | HMAC secret for issued JWTs. Generate a strong value in prod.   |
| `STORAGE_DIR`  | backend            | `./uploads`                                                  | Filesystem path where uploaded documents are stored.            |
| `PORT`         | backend            | `3000`                                                       | HTTP port the Express app listens on.                           |
| `NODE_ENV`     | backend            | unset (dev) / `production` (compose, Render)                 | Standard Node env switch.                                       |

On Render the values are wired through `render.yaml`:
`DATABASE_URL` comes from the managed Postgres add-on,
`JWT_SECRET` is auto-generated, `PORT` is injected by the platform,
and `STORAGE_DIR` is set to `/tmp/uploads` (ephemeral — fine for POC).

## Render Deployment

The repo ships a Render Blueprint (`render.yaml`) that provisions three
resources in one click: a managed Postgres, the backend web service, and the
frontend static site.

1. Push this branch to GitHub (already done by CI / the agent).
2. In the Render dashboard: **New → Blueprint** and point it at this repo.
3. Render parses `render.yaml`, shows the planned services, and asks for
   confirmation. Click **Apply**.
4. First build takes a few minutes (npm ci + Angular production build). The
   backend service runs migrations automatically on boot (TypeORM
   `synchronize: true`).
5. After deploy, confirm:
   - Backend `https://edelweiss-backend.onrender.com/api/health` returns OK.
   - Frontend `https://edelweiss-frontend.onrender.com` loads the SPA.
6. If Render assigns a hostname other than `edelweiss-backend.onrender.com`,
   edit the rewrite `destination` for `/api/*` in `render.yaml` to point at
   the real backend URL and re-sync the Blueprint.
7. Optional post-deploy env tweaks in the Render dashboard:
   - Rotate `JWT_SECRET` if you want a fresh value.
   - Move `STORAGE_DIR` onto a Render Disk if you need uploads to persist
     across deploys.

## License

UNLICENSED — see [LICENSE](./LICENSE).
