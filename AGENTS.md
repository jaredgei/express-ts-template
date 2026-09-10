# AGENTS.md

The best code is the code never written. Optimize for the smallest change that fully solves the problem, and read the code a change touches before writing anything.

## Before writing code

Stop at the first rung that holds:

1. Does this need to exist? If not, don't build it.
2. Does it already exist in this repo? Reuse it; don't re-implement.
3. Does the standard library or a native platform feature cover it? Use it.
4. Does an already-installed dependency solve it? Use it.
5. Can it be one line? Make it one line.
6. Only then write the minimum that works.

Deletion over addition. Boring over clever. Fewest files possible. Fix bugs at the root cause (the shared function), not per caller. Never cut validation, error handling, security, or accessibility to save code.

## Architecture

Layered, one domain per file across layers:

- `src/models/` — Drizzle tables via `createModel` (auto `id`/`createdAt`/`updatedAt` + derived Zod schemas). Registered in `src/models/index.ts`.
- `src/routes/` — declarations via `createRouter`; each route names its Zod schemas, status, summary, and `security`. Validation and OpenAPI docs are derived from this single declaration.
- `src/handlers/` — request handlers plus their request/response Zod schemas.
- `src/middleware/` — cross-cutting concerns (auth, logging, security, validation).
- `src/utils/` — shared building blocks (auth, database, route builder, schema factory, swagger).

Prefer extending these abstractions over bypassing them. A new endpoint is a `createRouter` declaration + a handler + (if needed) a model, not raw `express.Router` wiring.

## Verification (must pass before work is done)

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
```

Use `npm run format` to auto-fix formatting, then re-run the checks.

## Import order

Group imports into blocks separated by a blank line. Node built-ins first, then external packages, then internal modules ordered by layer (models, routes, handlers, middleware, utils):

```ts
import crypto from 'crypto';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { users, publicUserColumns } from '../models/user';
import { authenticate } from '../middleware/auth';
import { db } from '../utils/database';
```

## Code style

- Write the smallest clear implementation. Prefer concise over verbose or cleverly dense.
- **No comments.** Convey intent through naming, not prose. Do not add comments to explain what code does, restate logic, or narrate changes. A single-line comment is allowed only for a genuinely non-obvious "why". This is a hard rule, not a preference.
- Use TypeScript's `type` keyword, not `interface`.
- Never use `any`. Use a precise type, a generic, or `unknown` with narrowing.
- No unsafe casts. Never `as unknown as X`. A single proven `as` is a last resort.
- Never disable a lint rule inline. Fix the underlying issue.
- Don't name a variable used only once; inline it. Keep a name only when reused or when it genuinely aids readability.
- Always `async`/`await`, never `.then()`/`.catch()`/`.finally()` chains (except where a library requires a callback).
- Handlers are `async` and terminal in their chain; rely on Express 5 to forward rejected promises to the global error handler. Do not wrap every handler in try/catch.
- Use modern ES6+: `const`/`let` (never `var`), arrow functions, template literals, destructuring, spread/rest, default params, `?.`, `??`, and array/object methods over manual loops where they read clearly.

## Security

- Never commit real secrets. `.env` is gitignored; `.env.example` holds safe placeholders.
- Auth is server-side sessions over an `httpOnly` cookie (BFF pattern), stored in Postgres and revocable on logout. No tokens in client-readable storage.
- Passwords are hashed with argon2id. Never log or return `passwordHash`; exclude it at the query level (`publicUserColumns`), not in JS after the fact.
- Validate all external input with Zod at the route boundary. Never trust `req.body`/`req.query`/`req.params` unvalidated.
- The global error handler returns generic messages for 500s; never leak internal error details to clients.

## Database

- All models use the `createModel` factory. Never call `pgTable` directly in a model file.
- Schema changes: edit the model, then `npm run db:generate` to produce a migration in `drizzle/`. Do not hand-edit generated SQL.
- Queries go through the shared `db` from `src/utils/database.ts`. Select explicit columns; paginate list endpoints (`limit`/`offset` or cursor) — never return unbounded result sets.

## Dependencies

- Keep dependencies minimal. Prefer the standard library and existing repo code over a new package.
- Do not add a dependency without clear justification. When in doubt, ask first.

## Testing

- Vitest + Supertest. Tests live in `src/__tests__/`, mirroring the source layout (`src/__tests__/utils/session.test.ts`, `src/__tests__/handlers/user.test.ts`); never beside the code they cover. Shared harness (e.g. `global-setup.ts`) stays at the `__tests__` root. Unit-test utilities directly; integration-test routes through the app via Supertest.
- Integration tests run against the dedicated `express_ts_test` database provisioned in `src/__tests__/global-setup.ts`. Reset state between tests (`beforeEach`), don't depend on ordering.
- Test behavior through the public API: hit the endpoint, assert status and response body, assert what a client actually observes (including that secrets like `passwordHash` are absent).
