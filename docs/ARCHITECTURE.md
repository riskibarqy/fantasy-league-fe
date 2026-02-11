# Architecture

## Goals

- Maintain clear domain boundaries for long-term scaling.
- Keep UI/framework details isolated from business logic.
- Make backend integration replaceable without rewriting feature logic.

## Layering

```
presentation -> application -> domain
infrastructure -> application/domain contracts
app (composition root) wires dependencies
```

### Domain (`src/domain`)

- Entities and value-like structures (`User`, `Player`, `TeamLineup`, etc.)
- Repository interfaces/contracts
- Domain rules (`validateLineup`)

Rules:
- No React, no network calls, no browser APIs.

### Application (`src/application`)

- Usecases (`LoginWithPassword`, `GetFixtures`, `SaveLineup`)
- Input validation and orchestration across repository contracts

Rules:
- No direct framework coupling.
- Usecases should return plain domain-friendly data.

### Infrastructure (`src/infrastructure`)

- HTTP clients/adapters
- Mock repository implementations for local development

Rules:
- External systems live here (Anubis auth, fantasy backend).
- Convert transport details into domain/app models.

### Presentation (`src/presentation`)

- React pages/components/hooks
- State and interaction handling

Rules:
- Do not implement business rules directly in components.
- Delegate to usecases.

### Composition Root (`src/app/dependencies`)

- Decides which implementation is active (mock or real API)
- Instantiates repositories/usecases

## Dependency Rule

- Inner layers must not depend on outer layers.
- Outer layers may depend on inner-layer contracts.

## Extension Strategy

When adding a new feature:
1. Define domain types/contracts first.
2. Add usecase logic next.
3. Implement infrastructure adapters (mock + real API when available).
4. Build presentation using usecases only.
5. Add unit tests for domain and usecase behavior.
