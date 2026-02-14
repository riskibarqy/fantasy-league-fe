# Fantasy League FE

Frontend for fantasy football platform focused on Indonesian leagues first, but designed to support multi-league expansion.

## Tech Stack

- React 18 + TypeScript + Vite
- Clean Architecture + DDD boundaries
- Vitest for unit tests
- Mobile-first responsive UI (PWA-ready manifest)

## Project Structure

```
src/
  app/
    config/            # environment config
    dependencies/      # composition root / dependency injection
  domain/
    auth/              # entities + repository contracts
    fantasy/           # entities + repository contracts + domain rules
  application/
    auth/usecases/     # app logic for auth
    fantasy/usecases/  # app logic for fantasy operations
  infrastructure/
    auth/              # repository impl for Anubis/mock
    fantasy/           # repository impl for Fantasy API/mock
    http/              # shared HTTP client
    mocks/             # mocked fixtures, players, lineup
  presentation/
    components/        # reusable UI components
    hooks/             # session state
    pages/             # route pages
  styles/
```

## Run Locally

1. Install dependencies:
```bash
make install
```

2. Start app:
```bash
make dev
```

3. Run tests:
```bash
make test
```

4. Full quality check:
```bash
make check
```

## Environment

Copy `.env.example` to `.env` and adjust:

- `VITE_USE_MOCKS=true` to use mock repositories (default, backend not required)
- `VITE_USE_MOCKS=false` to call real services
- `VITE_ANUBIS_BASE_URL` points to `../../rust/anubis` runtime URL
- `VITE_ANUBIS_APP_ID` Anubis app UUID used for session endpoints
- `VITE_GOOGLE_CLIENT_ID` Google Identity Services client ID
- `VITE_FANTASY_API_BASE_URL` points to `../../go/fantasy-league` runtime URL

## Deploy To Vercel

- Use Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- Node.js version: `20.x` (recommended)

Set these Environment Variables in Vercel Project Settings:

- `VITE_USE_MOCKS`
- `VITE_ANUBIS_BASE_URL`
- `VITE_ANUBIS_APP_ID`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_FANTASY_API_BASE_URL`

Notes:
- Dockerfile is not required for Vercel deployment.
- `vercel.json` includes SPA rewrite so direct URLs like `/team` do not 404.

## Current Mock Scope

- Login page with mocked credentials (`password123`)
- Dashboard overview
- Team builder with pitch view, adjustable formation, and 5-player bench
- Fixtures list by league
- Leagues page (multi-league preview)

## Integration Notes

### Anubis Auth (`../../rust/anubis`)

Expected endpoints (placeholder contract):
- `POST /v1/apps/:app_id/sessions`
- `POST /v1/apps/:app_id/sessions/google`

### Fantasy Backend (`../../go/fantasy-league`)

Expected endpoints (placeholder contract):
- `GET /v1/dashboard`
- `GET /v1/leagues`
- `GET /v1/leagues/:leagueId/fixtures`
- `GET /v1/leagues/:leagueId/players`
- `GET /v1/leagues/:leagueId/lineup`
- `PUT /v1/leagues/:leagueId/lineup`

## Scaling Notes

- Repository contracts isolate API changes from UI layer.
- Usecases contain business logic and validation to avoid fat components.
- Domain rule (`validateLineup`) is testable and framework-independent.
- App can be wrapped with Capacitor later for iOS/Android without rewriting core frontend.

## Developer Docs

- `/Users/riskiramdan/ts/fantasy-league-fe/docs/DEVELOPMENT.md`
- `/Users/riskiramdan/ts/fantasy-league-fe/docs/ARCHITECTURE.md`
- `/Users/riskiramdan/ts/fantasy-league-fe/docs/INTEGRATION.md`
