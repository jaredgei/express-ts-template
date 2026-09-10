# Express + TypeScript Template

An opinionated starter for backend APIs: **Express 5 + TypeScript + PostgreSQL** via **Drizzle ORM**, validated with **Zod**, documented with auto-generated **OpenAPI/Swagger**, and tested with **Vitest + Supertest**. It ships with a type-safe route builder, a model factory, session-based auth, and CI so a new service starts with real building blocks instead of boilerplate wiring.

![CI](https://github.com/jaredgei/express-ts-template/actions/workflows/ci.yml/badge.svg)

## Stack

- **Express 5** — async route handlers with automatic rejected-promise forwarding to the error handler
- **TypeScript** in strict mode (`noUnusedLocals`/`noUnusedParameters`)
- **PostgreSQL** via **Drizzle ORM** (`postgres.js` driver) with generated SQL migrations
- **Zod** for request validation, derived from a single route declaration
- **OpenAPI 3** docs generated from those same schemas, served via **Swagger UI**
- **Vitest** + **Supertest** for unit and integration tests against a dedicated test database
- **ESLint** (flat config) + **Prettier**
- **Helmet** for secure HTTP headers

## Design decisions

- **Single-declaration routes.** A route names its Zod schemas, status, summary, and auth requirement once (`createRouter`). Request validation middleware _and_ OpenAPI documentation are both derived from that one declaration — no drift between what's validated and what's documented.
- **Model factory.** Every table is defined through `createModel`, which appends `id`/`createdAt`/`updatedAt` and derives `select`/`insert` Zod schemas, so models and their validation stay in sync.
- **BFF session auth.** Authentication uses server-side sessions over an `httpOnly` cookie (the Backend-for-Frontend pattern) rather than JWTs in client-readable storage. Sessions live in Postgres, so they're revocable on logout and immune to token theft via XSS. This template targets web apps on a shared origin, not mobile clients.
- **Passwords hashed with argon2id**, never logged or returned. `passwordHash` is excluded at the query level (`publicUserColumns`), not stripped in JS after the fact.
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
```

Never commit `.env`. Add new configuration keys to `.env.example` (with safe placeholder values) so they're documented for everyone.

## Scripts

| Script                   | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `npm run dev`            | Start the dev server (nodemon + ts-node, hot reload) |
| `npm run build`          | Compile TypeScript to `dist/`                        |
| `npm run start`          | Run the compiled server from `dist/`                 |
| `npm run typecheck`      | Run `tsc` with no emit                               |
| `npm run lint`           | Run ESLint                                           |
| `npm run format`         | Auto-fix formatting with Prettier                    |
| `npm run format:check`   | Check formatting without writing                     |
| `npm run test`           | Run the test suite once                              |
| `npm run test:watch`     | Run tests in watch mode                              |
| `npm run db:push`        | Sync schema directly to the DB (rapid dev)           |
| `npm run db:generate`    | Generate a SQL migration from model changes          |
| `npm run db:migrate`     | Apply pending migrations (development)               |
| `npm run db:migrate:prod`| Apply pending migrations (compiled, production)      |
| `npm run db:studio`      | Launch Drizzle Studio (visual DB explorer)           |

## Project structure

```
src/
  models/       Drizzle tables via createModel, registered in index.ts
  routes/       Route declarations via createRouter (schemas + docs)
  handlers/     Request handlers plus their request/response Zod schemas
  middleware/   Cross-cutting concerns (auth, logging, validation)
  utils/        Building blocks (auth, database, route builder, schema factory, swagger)
  scripts/      Operational scripts (migrate)
  __tests__/    Vitest unit + Supertest integration tests
  app.ts        App assembly (middleware, routes, docs, error handler)
  index.ts      Entry point (connect to DB, start server)
drizzle/        Generated SQL migrations and snapshots
```

Layered, one domain per file across layers. Adding an endpoint is a `createRouter` declaration + a handler + (if needed) a model — not raw `express.Router` wiring.

## What's included

- **Type-safe route builder** — `createRouter` registers a route's method, path, Zod schemas, status, summary, and auth flag once. Validation middleware is attached automatically and the OpenAPI spec is generated from the same source.
- **Model factory** — `createModel` gives every table `id` (UUID), `createdAt`, and `updatedAt`, and derives `select`/`insert` Zod schemas via `drizzle-zod`.
- **Session-based auth** — register/login/logout plus a protected `/me` endpoint, backed by server-side sessions in Postgres over an `httpOnly` cookie.
- **Auto-generated API docs** — Swagger UI at `/docs`, built from the route registry, with a configured bearer/cookie security scheme.
- **Structured request logging** — JSON access logs with method, path, status, and latency.
- **Hardened error handling** — a global handler returns JSON, logs full detail server-side, and never leaks internal messages for 5xx responses.

## Database

Models live in `src/models/` and are registered in [`src/models/index.ts`](./src/models/index.ts). Every model uses the `createModel` factory rather than calling `pgTable` directly.

Schema changes flow through generated migrations: edit the model, run `npm run db:generate` to produce SQL in `drizzle/`, then `npm run db:migrate` to apply it. Use `npm run db:push` for throwaway rapid iteration, and `npm run db:studio` to browse data.

## Testing

Tests live in `src/__tests__/`. Utilities are unit-tested directly; routes are integration-tested through the app with Supertest. Integration tests run against a dedicated `express_ts_test` database that is created and torn down automatically (`src/__tests__/global-setup.ts`), so runs are isolated and repeatable.

```bash
npm run test        # run once
npm run test:watch  # watch mode
```

## Continuous integration

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every push to `main` and on all pull requests. It provisions a Postgres service container, installs from the lockfile with `npm ci`, then runs, in order:

```
typecheck → lint → format:check → test
```

## AI agents

An [AGENTS.md](./AGENTS.md) is included so AI coding agents produce code that matches this project's conventions.
