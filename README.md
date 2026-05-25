# edelweiss-demo

Edelweiss vendor onboarding — fullstack POC.

This repository is an npm-workspaces monorepo. Application packages live under
`apps/*` and are added by later slices (backend API, frontend UI).

## Setup

_Placeholder — concrete setup commands are filled in by later slices once the
backend and frontend workspaces are scaffolded._

For now:

1. Install Node.js (LTS) and npm.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env` and adjust values.
4. Start the local Postgres for development: `docker compose up -d db`.

## Local Dev

```sh
npm run dev
```

Runs `dev` in every workspace that defines it (`--workspaces --if-present`).

## Tests

```sh
npm test
```

Delegates to each workspace's `test` script when present.

## License

UNLICENSED — see [LICENSE](./LICENSE).
