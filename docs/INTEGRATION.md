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
VITE_FANTASY_API_BASE_URL=http://localhost:8080
```

## Expected Auth Endpoints (Anubis)

- `POST /v1/auth/login`
- `POST /v1/auth/logout`

Client mapping:
- `/Users/riskiramdan/ts/fantasy-league-fe/src/infrastructure/auth/HttpAuthRepository.ts`

## Expected Fantasy Endpoints

- `GET /v1/dashboard`
- `GET /v1/leagues`
- `GET /v1/leagues/:leagueId/fixtures`
- `GET /v1/leagues/:leagueId/players`
- `GET /v1/leagues/:leagueId/lineup`
- `PUT /v1/leagues/:leagueId/lineup`

Client mapping:
- `/Users/riskiramdan/ts/fantasy-league-fe/src/infrastructure/fantasy/HttpFantasyRepository.ts`

## Contract Assumptions

- Auth response includes access token, refresh token, expiry, and user profile.
- Lineup saves must validate formation and captain/vice-captain constraints.
- Date fields are ISO-8601 UTC timestamps.

## Production Readiness Checklist

1. Confirm endpoint paths and DTO fields with backend.
2. Add token refresh strategy and 401 retry behavior.
3. Add centralized error mapping from API -> UX message.
4. Add request tracing/correlation id support if backend provides it.
