# Integration Notes

This frontend is mock-first while backend services are under development.

## Service Mapping

- Auth service: `../../rust/anubis`
- Fantasy backend: `../../go/fantasy-league`

## Environment Wiring

Set in `.env`:

```bash
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_SKIP_ONBOARDING_DEV=false
NEXT_PUBLIC_ANUBIS_BASE_URL=http://localhost:8081
NEXT_PUBLIC_ANUBIS_APP_ID=00000000-0000-0000-0000-000000000000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
NEXT_PUBLIC_FANTASY_API_BASE_URL=http://localhost:8080
```

For Vercel, set the same `NEXT_PUBLIC_*` variables in Project Settings -> Environment Variables.
`NEXT_PUBLIC_SKIP_ONBOARDING_DEV` is intended for local/dev iteration and should stay `false` in production.

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
- `POST /v1/custom-leagues` (requires `Authorization: Bearer <token>`)
- `POST /v1/custom-leagues/join` (requires `Authorization: Bearer <token>`)
- `GET /v1/custom-leagues/me` (requires `Authorization: Bearer <token>`)
- `GET /v1/custom-leagues/{groupId}` (requires `Authorization: Bearer <token>`)
- `GET /v1/custom-leagues/{groupId}/standings` (requires `Authorization: Bearer <token>`)

Client mapping:
- `/Users/riskiramdan/ts/fantasy-league-fe/src/infrastructure/fantasy/HttpFantasyRepository.ts`

## Contract Assumptions

- Auth response includes access token, refresh token, expiry, and user profile.
- API responses are wrapped using Google-style envelope:
  - success: `{ "apiVersion": "2.0", "data": ... }`
  - error: `{ "apiVersion": "2.0", "error": ... }`
- Lineup saves must validate:
  - starters: 11 players (`GK=1`, `DEF 2..5`, `MID <=5`, `FWD <=3`)
  - substitutes: exactly 4 players, no overlap with starters
  - captain/vice-captain must be in starters and must be different
- Squad pick payload (`POST /v1/fantasy/squads/picks`) must send exactly 15 `player_ids`.
- Date fields are ISO-8601 UTC timestamps.

## Production Readiness Checklist

1. Confirm endpoint paths and DTO fields with backend.
2. Add token refresh strategy and 401 retry behavior.
3. Add centralized error mapping from API -> UX message.
4. Add request tracing/correlation id support if backend provides it.

## Vercel Notes

- This project runs on Next.js runtime.
- Dockerfile is not required for Vercel.
