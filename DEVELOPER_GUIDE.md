# QA Roadmap Quest – Developer Guide

A deep-dive into the backend codebase: architecture, conventions, and workflows. Read this before extending or refactoring the service.

---

## 1. High-Level Architecture

```
┌───────────────┐        (HTTP)        ┌─────────────────┐
│  Frontend UI  │  ───────────────▶   │  Express Server │
└───────────────┘                     │  (TypeScript)   │
                                      └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ PostgreSQL +    │
                                      │  TypeORM ORM    │
                                      └─────────────────┘
```

* **Express** handles routing & middleware stack.
* **TypeORM** provides typed data-mapper entities – no active-record shortcuts.
* **OpenRouterService** integrates with hosted LLMs to generate questions.
* **JWT** secures every protected route. Tokens are short-lived (24h) + refresh flow.
* **Modular Separation**:
  * `entities/` – DB models only.
  * `routes/` – HTTP endpoints, thin controllers.
  * `services/` – external integrations & business logic.
  * `middleware/` – cross-cutting concerns (auth, logging, error handling).
  * `config/` – runtime configuration (DB, env helpers).
  * `migrations/` – reproducible SQL schema evolution.

---

## 2. Key Technologies & Versions

| Package | Version | Notes |
|---------|---------|-------|
| Node.js | 18+ | ES2022 modules features enabled by ts-node |
| TypeScript | 5.x | Strict mode is **on** |
| Express | 4.18 | Classic routing stack |
| TypeORM | 0.3 | Data-mapper pattern |
| jsonwebtoken | 9.x | HMAC-SHA256 tokens |
| OpenRouter SDK | via `axios` | no official SDK yet |

*See `package.json` for the full list.*

---

## 3. Database Layer

* **Connection**: configured in `src/config/database.ts`. Uses the full `DATABASE_URL` string + SSL (cert verification off in dev).
* **Entities**: each class maps 1-to-1 to a table. Keep business logic **out of entities**; favour services.
* **Migrations**: `npm run db:migrate` compiles TS and runs `dist/migrations/run-migrations.js` which in turn calls `dataSource.runMigrations()`. Add new migrations with TypeORM-CLI or a manual script.

### Entity Relationships (simplified)

```
User ───< EvaluationAttempt >─── Stage
  │                               │
  └──< UserStage >───────────────┘
EvaluationAttempt ───< UserResponse >─── Question
Question >─── Stage
Stage >───< Question (1:N)
```

---

## 4. Services Overview

### `openRouterService.ts`
* Singleton wrapper with lazy initialisation.
* `generateQuestions(stageTitle, difficulty, openQ, closedQ)` → returns array of AI-generated questions (MCQ & open-ended).
* Handles rate-limit & error retries.

Extend this service to swap providers or tune prompts.

---

## 5. Middleware Stack

1. **Helmet** – secure HTTP headers.
2. **RateLimiter** – 100 req / 15 min per IP.
3. **RequestLogger** – JSON/stdout access log.
4. **CORS** – origin pulled from `CORS_ORIGIN` env.
5. **AuthMiddleware** – verifies JWT, loads user, attaches to `req.user`.
6. **AdminMiddleware** – simple role check.
7. **ErrorHandler** – last in chain → unified JSON error envelope.

---

## 6. Authentication Flow

```
POST /api/auth/login → JWT (24h)
        │
        ▼
Include `Authorization: Bearer <token>` on subsequent requests.
If expired → POST /api/auth/refresh to get new token.
```

**Security notes**:
* Refresh endpoint also requires a valid (but maybe near-expiry) token.
* No refresh-token DB store yet; implement token revocation if needed.

---

## 7. Coding Conventions

* ESLint/Prettier configs coming soon – follow existing style.
* Prefer **async/await** over Promise chains.
* Throw typed `Error` subclasses for domain errors.
* Add JSDoc on public functions.
* Keep controllers thin; complex logic lives in services.

---

## 8. Running Tests

> Tests are not yet implemented. Suggested stack: `vitest` + `supertest` for HTTP, and TypeORM testcontainers for integration tests.

---

## 9. Debugging & Hot-reload

* **Dev server** uses `nodemon src/server.ts` with `ts-node` – changes reload instantly.
* VSCode launch configuration template:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Launch Dev Server",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "envFile": "${workspaceFolder}/.env",
  "skipFiles": ["<node_internals>/**"]
}
```

---

## 10. Deployment Notes

* **Build**: `npm ci && npm run build` → outputs to `dist/`.
* **Runtime**: only Node + env vars needed.
* **Process Manager**: PM2, Docker, Fly.io, Railway – any is fine.
* **Scaling**: stateless; horizontal scale behind a shared Postgres.

### Example Dockerfile (non-multi-stage)

```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . ./
RUN npm run build
CMD ["node", "dist/server.js"]
```

---

## 11. TODO / Roadmap

- [ ] Implement unit/integration test suites
- [ ] Token revocation & refresh-token rotation
- [ ] Swagger / OpenAPI specification & docs site
- [ ] Docker-compose for local PG + service
- [ ] CI pipeline (lint, tests, build, security scan)

---

## 12. Contact

Maintainer: **QA Roadmap Quest Team** – open an issue or email dev-support@qaq.quest
