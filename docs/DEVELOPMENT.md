# Development Guide

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- GNU Make (`make`)

## Quick Start

```bash
make install
make prepare-env
make dev
```

App default URL:
- `http://localhost:3000`

## Common Commands

- `make help`: list available targets
- `make typecheck`: TypeScript static checks
- `make test`: run unit tests once
- `make test-watch`: run tests in watch mode
- `make build`: production build
- `npm run build:spa`: SPA build output (`dist/`) for Capacitor sync
- `make check`: full quality gate (`typecheck + test + build`)
- `make clean`: remove generated artifacts

## VS Code Workflow

- `Run Task` -> choose from `.vscode/tasks.json`
- Optional debug:
  - Start dev server (`make dev`)
  - Run launcher `Open app in Chrome (Next)` from `.vscode/launch.json`

## Environment

Base variables from `.env.example`:

- `NEXT_PUBLIC_USE_MOCKS=true`: run mock mode
- `NEXT_PUBLIC_ANUBIS_BASE_URL=http://localhost:8081`: auth service
- `NEXT_PUBLIC_ANUBIS_APP_ID=<uuid>`: target app id in Anubis
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-client-id>`: Google Identity Services client id
- `NEXT_PUBLIC_FANTASY_API_BASE_URL=http://localhost:8080`: fantasy backend

If backend services are unavailable, keep `NEXT_PUBLIC_USE_MOCKS=true`.
