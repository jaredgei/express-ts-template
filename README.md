# Express + TypeScript Template

An opinionated starter for backend APIs: **Express 5 + TypeScript + PostgreSQL** via **Drizzle ORM**, validated with **Zod**, documented with auto-generated **OpenAPI/Swagger**, and tested with **Vitest + Supertest**. It ships with a type-safe route builder, a model factory, session-based auth, and CI so a new service starts with real building blocks instead of boilerplate wiring.

![CI](https://github.com/jaredgei/express-ts-template/actions/workflows/ci.yml/badge.svg)

## Stack

- **Express 5** — async route handlers with automatic rejected-promise forwarding to the error handler
- **TypeScript** in strict mode (`noUnusedLocals`/`noUnusedParameters`), native **ESM** (`tsx` in dev, `tsc` + `tsc-alias` for the build)
- **PostgreSQL** via **Drizzle ORM** (`postgres.js` driver) with generated SQL migrations
- **Zod** for request validation, derived from a single route declaration
- **OpenAPI 3** docs generated from those same schemas, served via **Swagger UI**
- **Vitest** + **Supertest** for unit and integration tests against a dedicated test database
- **ESLint** (flat config) + **Prettier**
- **Helmet** for secure HTTP headers
- **express-rate-limit** on credential endpoints (login/register)

## Design decisions

- **Single-declaration routes.** A route names its Zod schemas, status, summary, and auth requirement once (`createRouter`). Request validation middleware _and_ OpenAPI documentation are both derived from that one declaration — no drift between what's validated and what's documented. Handlers typed with `TypedRequest` infer `req.body`/`query`/`params` from the request schemas and `req.userId` when `security: true`.
- **Model factory.** Every table is defined through `createModel`, which appends `id`/`createdAt`/`updatedAt` and derives a public `select` Zod schema (private columns omitted), so models and their validation stay in sync.
- **BFF session auth.** Authentication uses server-side sessions over an `httpOnly` cookie (the Backend-for-Frontend pattern) rather than JWTs in client-readable storage. Sessions live in Postgres, so they're revocable on logout and immune to token theft via XSS. In production the cookie uses the `__Host-` prefix (requires `Secure`, `Path=/`, no `Domain`). This template targets web apps on a shared origin, not mobile clients.
- **Passwords hashed with argon2id**, never logged or returned. `passwordHash` is excluded at the query level (`publicUserColumns`), not stripped in JS after the fact.
- **Uniform errors.** Every error response is `{ errors: [{ message, field? }] }`. Throw `HttpError(status, message, field?)` from handlers and middleware; validation failures become `400` with per-field detail, unique-constraint violations `409`, foreign-key violations `409`; anything unexpected becomes a generic `500`.
- **CSRF defense in depth.** State-changing requests are rejected unless their `Origin` matches an allowed origin (`CORS_ORIGIN` or same-origin), on top of the `SameSite=lax` cookie.
- **Time zone safe.** All timestamps are `timestamptz`, and `updatedAt` is bumped automatically on update.
- **Secrets stay out of git.** `.env` is gitignored; `.env.example` documents the required keys.

## Getting started

Requires Node 22+ and Docker (for local Postgres).

```bash
docker compose up -d   # start PostgreSQL
npm install
npm run dev            # auto-creates .env from .env.example on first run
```

The server runs on `http://localhost:8008`. Interactive API docs are available at `http://localhost:8008/docs` in non-production environments.

### Environment variables

`.env` is gitignored and auto-created from [`.env.example`](./.env.example) the first time you run `npm run dev`, so the project runs out of the box. Edit `.env` to change credentials:

```env
PORT=8008
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/express_ts
CORS_ORIGIN=http://localhost:5173
TRUST_PROXY_HOPS=0
```

Environment variables are validated once at startup with Zod (`src/utils/env.ts`); the process refuses to boot on invalid or missing config. `CORS_ORIGIN` is a comma-separated allowlist of browser origins (empty disables cross-origin requests); credentials are enabled so the session cookie works with a separate-origin SPA. Set `TRUST_PROXY_HOPS` to the number of reverse proxies / load balancers in front of the app (e.g. `1` behind a single ALB) so `req.ip` and rate limiting use the real client address. Never trust all hops: that lets clients spoof their IP via `X-Forwarded-For`. Set `DATABASE_PREPARE=false` only when connecting through a transaction-mode pooler (PgBouncer, Supabase pooler).

Never commit `.env`. Add new configuration keys to `.env.example` (with safe placeholder values) and to the schema in `src/utils/env.ts`.

## Scripts

| Script                    | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `npm run dev`             | Start the dev server (tsx watch, hot reload)    |
| `npm run build`           | Compile TypeScript to `dist/`                   |
| `npm run start`           | Run the compiled server from `dist/`            |
| `npm run typecheck`       | Run `tsc` with no emit                          |
| `npm run lint`            | Run ESLint                                      |
| `npm run format`          | Auto-fix formatting with Prettier               |
| `npm run format:check`    | Check formatting without writing                |
| `npm run test`            | Run the test suite once                         |
| `npm run test:watch`      | Run tests in watch mode                         |
| `npm run db:generate`     | Generate a SQL migration from model changes     |
| `npm run db:migrate`      | Apply pending migrations (development)          |
| `npm run db:migrate:prod` | Apply pending migrations (compiled, production) |
| `npm run db:studio`       | Launch Drizzle Studio (visual DB explorer)      |

## Project structure

```
src/
  models/       Drizzle tables via createModel, registered in index.ts
  routes/       Route declarations via createRouter (schemas + docs), mounted in index.ts
  handlers/     Request handlers plus their request/response Zod schemas
  middleware/   Cross-cutting concerns (auth, csrf, errors, logging, rate limiting, validation)
  utils/        Building blocks (auth, database, env, lifecycle, logger, route builder, schema factory, session, swagger)
  scripts/      Operational scripts (migrate)
  __tests__/    Vitest unit + Supertest integration tests
  app.ts        App assembly (middleware, routes, docs, error handler)
  index.ts      Entry point (connect to DB, start server)
drizzle/        Generated SQL migrations and snapshots
```

Layered, one domain per file across layers. Adding an endpoint is a `createRouter` declaration + a handler + (if needed) a model — not raw `express.Router` wiring. A new domain adds its router to the array in `src/routes/index.ts`; `app.ts` is never touched.

Modules are imported via the `@/*` alias (`@/utils/database`) rather than deep relative paths; it maps to `src/*` and is resolved by `tsx` (dev), Vitest, drizzle-kit, and `tsc-alias` (build, which rewrites the alias to relative `.js` paths in `dist/`).

## What's included

- **Type-safe route builder** — `createRouter` registers a route's method, path, Zod schemas, status, summary, and auth flag once. Validation middleware is attached automatically, the OpenAPI spec is generated from the same source, and `req.body`/`query`/`params`/`userId` are typed from the declaration via `TypedRequest`.
- **Model factory** — `createModel` gives every table `id` (UUID), `createdAt`, and `updatedAt`, and derives a public `select` Zod schema via `drizzle-zod`. Private columns (e.g. `passwordHash`) are omitted from that schema and from `publicColumns`.
- **Session-based auth** — register/login/logout plus a protected `/me` endpoint, backed by server-side sessions in Postgres over an `httpOnly` cookie. Sessions rotate on login and slide (cookie reissued) once past half their lifetime. Declaring `security: true` on a route attaches `authenticate` and types `req.userId` as `string`.
- **Auto-generated API docs** — Swagger UI at `/docs`, built from the route registry, with a configured cookie security scheme.
- **Structured logging** — one JSON-lines logger (`src/utils/logger.ts`) for access logs and app events. A request ID is attached to every request (reusing a well-formed `x-request-id` header, otherwise generating one) and echoed back. Health probes are not logged.
- **Hardened error handling** — a global handler returns JSON, logs full detail server-side, and never leaks internal messages for 5xx responses.
- **Health checks** — `GET /health` (liveness, used by the Docker `HEALTHCHECK`) and `GET /ready` (readiness, pings the DB and reports 503 once shutdown begins; point your load balancer here).
- **Graceful shutdown** — `SIGTERM`/`SIGINT` flip readiness to 503, stop accepting connections, drain in-flight requests, and close the DB pool.
- **Container-ready** — a multi-stage [`Dockerfile`](./Dockerfile) builds a lean production image. Migrations are not run on container start; run `npm run db:migrate:prod` (e.g. `docker run <image> npm run db:migrate:prod`) as a one-off release step before rolling out, so multiple replicas never race on the schema.

## Rate limiting

`login` and `register` are rate limited (10 attempts / 15 min) as a brute-force and credential-stuffing backstop. `register` is keyed per client IP; `login` is keyed per IP **and** email, so stuffing a single account from many IPs is also throttled. The stores are in-memory and per process; when you run more than one instance, swap in a shared store such as [`rate-limit-redis`](https://github.com/express-rate-limit/rate-limit-redis) so limits hold across replicas and deploys. Broad, volumetric limiting (DDoS, scraping) belongs at the edge (load balancer / WAF / CDN), not here.

## Database

Models live in `src/models/` and are registered in [`src/models/index.ts`](./src/models/index.ts). Every model uses the `createModel` factory rather than calling `pgTable` directly.

Schema changes flow through generated migrations: edit the model, run `npm run db:generate` to produce SQL in `drizzle/`, then `npm run db:migrate` to apply it. Use `npm run db:studio` to browse data.

## Testing

Tests live in `src/__tests__/`. Utilities are unit-tested directly; routes are integration-tested through the app with Supertest. Integration tests run against a dedicated database (`express_ts_test` by default, override with `TEST_DATABASE_URL`) that is created, migrated, and torn down automatically (`src/__tests__/global-setup.ts`). Tests create uniquely keyed data and only query what they created, so files run in parallel safely.

```bash
npm run test        # run once
npm run test:watch  # watch mode
```

## Continuous integration

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every push to `main` and on all pull requests. It provisions a Postgres service container, installs from the lockfile with `npm ci`, then runs, in order:

```
typecheck → lint → format:check → test → build
```

## AI agents

An [AGENTS.md](./AGENTS.md) is included so AI coding agents produce code that matches this project's conventions.
