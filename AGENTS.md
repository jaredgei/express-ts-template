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

- `src/models/` — Drizzle tables via `createModel` (auto `id`/`createdAt`/`updatedAt` + a derived public `select` Zod schema). Registered in `src/models/index.ts`.
- `src/routes/` — one router per domain via `createRouter(prefix)`. Each route is a single declaration (Zod schemas, status, summary, `security`, declared `errors`, extra `use` middleware) plus its inline handler. Validation, response serialization, types, and OpenAPI docs all derive from it. Routers are listed in `src/routes/index.ts`.
- `src/middleware/` — cross-cutting concerns (auth, csrf, errors, logging, rate limiting, validation).
- `src/utils/` — shared building blocks (auth, database, env, lifecycle, logger, route builder, schema factory, session, swagger).

Prefer extending these abstractions over bypassing them. A new endpoint is one `router.get/post/...(path, spec, handler)` call + (if needed) a model, not raw `express.Router` wiring; a new domain adds its router to the array in `src/routes/index.ts`. Write handlers inline so `req` (`params`/`query`/`body`, and `userId` when `security: true`) is inferred from the spec; never annotate them by hand. Handlers **return** the response body; it is type-checked against `response`, parsed (undeclared fields are stripped), and sent with `status` (default `200`, or `204` with no `response`). Use `res` only for cookies/headers. Protected routes declare `security: true`; do not add `authenticate` manually. Document non-default error statuses in `errors: { 409: '...' }`.

## Verification (must pass before work is done)

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
```

Use `npm run format` to auto-fix formatting, then re-run the checks.

## Import order

Group imports into blocks separated by a blank line. Node built-ins first, then external packages, then internal modules ordered by layer (models, routes, middleware, utils). Internal modules use the `@/*` alias (maps to `src/*`), never deep relative paths:

```ts
import crypto from 'crypto';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { users, publicUserColumns } from '@/models/user';

import { HttpError } from '@/middleware/error';

import { db } from '@/utils/database';
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
- Handlers are `async` and terminal in their chain; rely on Express 5 to forward rejected promises to the global error handler. Do not wrap every handler in try/catch. Signal client errors with `throw new HttpError(status, message)`.
- Log through `logJson()` from `src/utils/logger.ts`, never `console.*`.
- Use modern ES6+: `const`/`let` (never `var`), arrow functions, template literals, destructuring, spread/rest, default params, `?.`, `??`, and array/object methods over manual loops where they read clearly.
- The project is native ESM (`"type": "module"`). Use `import`/`export` only — never `require`/`module.exports`, `__dirname`, or `__filename` (use `import.meta.url`/`import.meta.dirname`).

## Security

- Never commit real secrets. `.env` is gitignored; `.env.example` holds safe placeholders.
- Read configuration only through the validated `env` object in `src/utils/env.ts`, never `process.env` directly in feature code. New config keys are added to the Zod schema there and to `.env.example`.
- Auth is server-side sessions over an `httpOnly` cookie (BFF pattern), stored in Postgres and revocable on logout. No tokens in client-readable storage. In production the cookie name is `__Host-sid`. Read, set, and clear the cookie only through `src/utils/session.ts` (`sessionToken`, `startSession`, `endSession`), the single source of cookie flags.
- Passwords are hashed with argon2id. Never log or return `passwordHash`; exclude it at the query level (`publicUserColumns`), not in JS after the fact.
- Never log request bodies, query strings, cookies, or headers. Log errors with `...errorFields(error)`, never `error.message`/`String(error)` directly: `DrizzleQueryError` messages embed bound parameters.
- Validate all external input with Zod at the route boundary. Never trust `req.body`/`req.query`/`req.params` unvalidated; inside `createRouter` handlers, undeclared `params`/`query` are typed as empty so reading them is a compile error. Normalize comparable identifiers (e.g. lowercase/trim email) in the schema so stored and queried values match.
- State-changing requests are checked by `verifyOrigin` (`Sec-Fetch-Site: same-origin`, else an allowed `Origin`) on top of `SameSite=lax`. CSRF safety assumes the server only parses `application/json`; if you add `express.urlencoded()` or trust sibling subdomains, revisit this.
- API responses are `Cache-Control: no-store` (set by `createRouter`).
- The global error handler returns generic messages for 500s; never leak internal error details to clients. Error bodies are always `{ errors: [{ message, field? }] }`. Throw `HttpError(status, message, field?)`; validation middleware throws `ValidationError` with per-field detail. Do not write error responses by hand in middleware or handlers.
- Credential endpoints use their rate limiters (`registerRateLimiter`; `loginIpRateLimiter` + `loginEmailRateLimiter`). Create new limiters with `createLimiter` so their store is registered. Do not skip them in tests; reset every entry in `rateLimitStores` instead.
- Scope every query over user-owned data to `req.userId`. Never expose cross-user listings (e.g. all users) without an authorization check.

## Database

- All models use the `createModel` factory. Never call `pgTable` directly in a model file. Pass private columns and indexes via the options object (`{ private: [...], indexes }`). Use `timestamptz` from `src/utils/schema.ts` for time columns, never bare `timestamp`.
- Let unique constraints/indexes enforce uniqueness; don't check-then-insert. The error handler maps unique violations (`23505`) and foreign-key violations (`23503`) to `409`.
- Schema changes: edit the model, then `npm run db:generate` to produce a migration in `drizzle/`. Do not hand-edit generated SQL.
- `noUncheckedIndexedAccess` is on: destructured rows (`const [user] = await db...`) are possibly `undefined`; handle the missing case (usually `throw new HttpError(404, ...)`).
- Queries go through the shared `db` from `src/utils/database.ts`. Select explicit columns. Paginate list endpoints (`limit`/`offset` or cursor) with a stable `orderBy` (e.g. `createdAt, id`) — never return unbounded result sets, and never offset-paginate without an order, which can skip or repeat rows.

## Dependencies

- Keep dependencies minimal. Prefer the standard library and existing repo code over a new package.
- Do not add a dependency without clear justification. When in doubt, ask first.

## Testing

- Vitest + Supertest. Tests live in `src/__tests__/`, mirroring the source layout (`src/__tests__/utils/session.test.ts`, `src/__tests__/routes/user.test.ts`, app-wide behavior in `src/__tests__/app.test.ts`); never beside the code they cover. Shared harness (e.g. `global-setup.ts`) stays at the `__tests__` root. Unit-test utilities directly; integration-test routes through the app via Supertest.
- Integration tests run against the dedicated test database provisioned in `src/__tests__/global-setup.ts` (its name must end in `_test`; setup drops and recreates it). Test files run in parallel against it, so each test creates its own uniquely keyed data (e.g. `crypto.randomUUID()` emails) and only queries rows by the ids it created; never truncate tables or assert on global counts.
- Test behavior through the public API: hit the endpoint, assert status and response body, assert what a client actually observes (including that secrets like `passwordHash` are absent).
