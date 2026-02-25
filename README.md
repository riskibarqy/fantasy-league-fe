# Fantasy League FE

Frontend for fantasy football platform focused on Indonesian leagues first, but designed to support multi-league expansion.

## Tech Stack

- Next.js 15 (App Router) + React 18 + TypeScript
- Tailwind CSS v4 + shadcn/ui primitives
- Vite build pipeline for Capacitor web asset sync (`dist/`)
- Capacitor (Android + iOS wrapper for mobile app install)
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

## Run As Mobile App (Capacitor)

This project is configured with Capacitor and already has native wrappers in:

- `android/`
- `ios/`

Typical workflow after frontend changes:

1. Sync web build to native projects:
```bash
make cap-sync
```

`make cap-sync` uses the SPA build pipeline (`npm run build:spa`) so native wrappers always receive `dist/` assets.

2. Open Android:
```bash
make mobile-android
```

3. Open iOS:
```bash
make mobile-ios
```

You can also run each step separately:

- `make cap-sync-android`
- `make cap-sync-ios`
- `make open-android`
- `make open-ios`

Prerequisites:

- Android Studio (Android SDK installed)
- Xcode + CocoaPods (for iOS on macOS)

## Environment

Copy `.env.example` to `.env` and adjust:

- `NEXT_PUBLIC_USE_MOCKS=true` to use mock repositories (default, backend not required)
- `NEXT_PUBLIC_USE_MOCKS=false` to call real services
- `NEXT_PUBLIC_ANUBIS_BASE_URL` points to `../../rust/anubis` runtime URL
- `NEXT_PUBLIC_ANUBIS_APP_ID` Anubis app UUID used for session endpoints
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` Google Identity Services client ID
- `NEXT_PUBLIC_FANTASY_API_BASE_URL` points to `../../go/fantasy-league` runtime URL

## Deploy To Vercel

- Use Framework Preset: `Next.js`
- Build Command: `npm run build`
- Install Command: `npm install`
- Node.js version: `20.x` (recommended)

Set these Environment Variables in Vercel Project Settings:

- `NEXT_PUBLIC_USE_MOCKS`
- `NEXT_PUBLIC_ANUBIS_BASE_URL`
- `NEXT_PUBLIC_ANUBIS_APP_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_FANTASY_API_BASE_URL`

Notes:
- Dockerfile is not required for Vercel deployment.
- Routing is served by Next App Router catch-all page.

## Current Mock Scope

- Login page with mocked credentials (`password123`)
- Dashboard overview
- Team builder with pitch view, adjustable formation, and 4-player bench
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
- `GET /v1/fantasy/squads/me?league_id={leagueId}` (requires bearer token)
- `POST /v1/fantasy/squads/picks` (requires bearer token)

## Scaling Notes

- Repository contracts isolate API changes from UI layer.
- Usecases contain business logic and validation to avoid fat components.
- Domain rule (`validateLineup`) is testable and framework-independent.
- App is already wrapped with Capacitor for iOS/Android without rewriting core frontend.
- Request caching is centralized in `/Users/riskiramdan/ts/fantasy-league-fe/src/app/cache/requestCache.ts`:
  use `getOrLoadCached` + `cacheKeys` + `cacheTtlMs` for new pages/usecases to avoid refetching on every route switch.

## Developer Docs

- `/Users/riskiramdan/ts/fantasy-league-fe/docs/DEVELOPMENT.md`
- `/Users/riskiramdan/ts/fantasy-league-fe/docs/ARCHITECTURE.md`
- `/Users/riskiramdan/ts/fantasy-league-fe/docs/INTEGRATION.md`
