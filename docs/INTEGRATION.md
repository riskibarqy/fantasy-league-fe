# Integration Notes

This frontend is mock-first while backend services are under development.

## Service Mapping

- Auth service: `../../rust/anubis`
- Fantasy backend: `../../go/fantasy-league`

## Environment Wiring

Set in `.env`:

```bash
VITE_USE_MOCKS=false
VITE_ANUBIS_BASE_URL=http://localhost:8081
VITE_ANUBIS_APP_ID=00000000-0000-0000-0000-000000000000
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_FANTASY_API_BASE_URL=http://localhost:8080
```

For Vercel, set the same `VITE_*` variables in Project Settings -> Environment Variables.

## Expected Auth Endpoints (Anubis)

- `POST /v1/apps/{app_id}/sessions` (email/password)
- `POST /v1/apps/{app_id}/sessions/google` (Google id_token; handles login/signup)

Client mapping:
- `/Users/riskiramdan/ts/fantasy-league-fe/src/infrastructure/auth/HttpAuthRepository.ts`

## Expected Fantasy Endpoints

- `GET /v1/dashboard`
- `GET /v1/leagues`
- `GET /v1/leagues/:leagueId/fixtures`
- `GET /v1/leagues/:leagueId/players`
- `GET /v1/leagues/:leagueId/lineup`
- `PUT /v1/leagues/:leagueId/lineup`
- `GET /v1/fantasy/squads/me?league_id={leagueId}` (requires `Authorization: Bearer <token>`)
- `POST /v1/fantasy/squads/picks` (requires `Authorization: Bearer <token>`)

Client mapping:
- `/Users/riskiramdan/ts/fantasy-league-fe/src/infrastructure/fantasy/HttpFantasyRepository.ts`

## Contract Assumptions

- Auth response includes access token, refresh token, expiry, and user profile.
- API responses are wrapped using Google-style envelope:
  - success: `{ "apiVersion": "2.0", "data": ... }`
  - error: `{ "apiVersion": "2.0", "error": ... }`
- Lineup saves must validate:
  - starters: 11 players (`GK=1`, `DEF 2..5`, `MID <=5`, `FWD <=3`)
  - substitutes: exactly 5 players, no overlap with starters
  - captain/vice-captain must be in starters and must be different
- Date fields are ISO-8601 UTC timestamps.

## Production Readiness Checklist

1. Confirm endpoint paths and DTO fields with backend.
2. Add token refresh strategy and 401 retry behavior.
3. Add centralized error mapping from API -> UX message.
4. Add request tracing/correlation id support if backend provides it.

## Vercel Notes

- This project is a static Vite build (no server runtime required).
- Dockerfile is not required for Vercel.
- SPA route fallback is handled via `/Users/riskiramdan/ts/fantasy-league-fe/vercel.json`.
