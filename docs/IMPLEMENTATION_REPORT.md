# Sanad Production Handover — Implementation Report

Branch: `handover/production-ready` (not pushed, per instructions).
Base: `main` @ `53030db first commit`. Reviewer: everything below was actually
executed in this repo; outputs are quoted verbatim. Gaps are listed in §8.

## 1. Phase summaries and file changes

### Phase 0 — Audit (no code changes, nothing committed)
- Listed all 15 API endpoints: only `GET /api/auth/me` required auth, and it
  trusted a raw localStorage token; every store/products/orders route was
  anonymous and trusted `:subdomain` from the client (full cross-tenant read/write).
- Frontend findings: `GrowthCenterPreview` rendered hardcoded `sampleOrders`,
  KPIs (`148,500`), products and shipping zones with zero API calls;
  `MigrationCenterView` faked uploads with `setTimeout` + `alert()`;
  `HelpCenterView` search input never filtered; `LoginModal` shipped a
  hardcoded demo account plus an auth bypass that entered the cockpit on any
  backend failure; `StoreCreationModal` showed success even when saving failed.
- Secrets: no real secrets in git history (only placeholder
  `MY_GEMINI_API_KEY`); `@google/genai` was a dependency but imported nowhere;
  `dist/` contained 0 GEMINI matches but did contain the demo email and
  `sanad_token` localStorage key.

### Phase 1 — Security (`8e8ff7a`)
Deny-by-default authorization; httpOnly SameSite=Lax cookies (Secure in prod),
SHA-256 → later HMAC session hashes; Argon2id (m=19456,t=2,p=1) with scrypt
re-hash on login; atomic register (killed handle-claim hijack); DEMO-gated
seed + removed client bypasses; helmet, strict CORS, 256kb JSON limit,
rate limits, trust-proxy env, CSRF origin check, `{error:{code,message}}`
shape, redacted pino logs, strict zod validation.
- Created: `server/env.ts, errors.ts, logger.ts, middleware.ts, validate.ts`
- Modified: `server/auth.ts, db.ts, index.ts, src/lib/api.ts,
  src/components/LoginModal.tsx, StoreCreationModal.tsx, .env.example,
  package.json (+argon2/helmet/rate-limit/pino/zod/cookie-parser/cors)`
- Verified: `tsc` clean, `vite build` ok, live matrix (login/cookie/me/owner/
  wrong-pw 401/strict 400/anon 401/logout/post-logout 401; demo-off 404 +
  register/dup-409/cross-403/change-password; scrypt→argon2id rehash).

### Phase 2 — Database (`ba7bbbc`)
PostgreSQL 16 + Prisma 7.10.0; schema (stores, merchants, products, orders,
order_items, leads, sessions) with uniques, FK indexes, onDelete rules;
real migration `prisma/migrations/20261015133513_init`; standalone
`prisma/seed.ts` (demo-gated, never on boot); `docker-compose.yml` (db);
`db:migrate / db:migrate:dev / db:seed / db:reset` (reset refuses production);
all node:sqlite code removed.
- Created: `docker-compose.yml, prisma.config.ts, prisma/schema.prisma,
  prisma/seed.ts, prisma/migrations/…, scripts/db-reset.mjs`
- Modified: `server/db.ts (Prisma+pg adapter), index.ts, middleware.ts,
  env.ts (DATABASE_URL fail-fast), package.json, .env(.example)`
- Verified: `migrate dev` applied, seed created demo rows, full smoke on real
  Postgres (200/403/401/201/409/400 as expected).

### Phase 3 — Complete API + frontend wiring (`c2e7f8f`)
Products CRUD + pagination/search; orders filters + transitions (422);
public rate-limited checkout with server-side pricing/stock; store settings
(subdomain immutable); scoped leads; fixed CORS breaking served assets.
Frontend: session-aware App/Navbar + logout; cockpit rewritten on live data
(overview/orders/products/settings incl. status updates, product CRUD, settings
+ password change); migration center parses real CSVs + records leads; help
search filters for real.
- Modified: `server/index.ts, middleware.ts (+attachAuth), validate.ts,
  src/lib/api.ts, src/App.tsx, Navbar.tsx, GrowthCenterPreview.tsx,
  StoreCreationModal.tsx (was Phase 1), HelpCenterView.tsx, MigrationCenterView.tsx`
- Verified: `tsc`, `vite build`, live checkout math (2×250=500, stock 8→6),
  400/409 abuse cases, transition 200/422/200, settings 200, delete→404.

### Phase 4 — Build/config/cleanup (`78b42b0`)
`npm start` = esbuild bundle `dist-server/server.cjs` on plain node
(`prestart` rebuilds when esbuild exists); package renamed to
`sanad@1.0.0` + `engines node 24.x`; session HMAC bound to SESSION_SECRET
(fail-fast 32+ chars in prod); health checks DB (503 when down); removed
`metadata.json`, `@google/genai`, template README (rewritten in Phase 6),
`server.js` clean script; completed `.env.example`.
- Created: `scripts/build-server.mjs` — Modified: `package.json (+lock),
  server/auth.ts, env.ts, index.ts, .env.example, .gitignore`
- Verified: prod bundle boot (`HEALTH=True DB=up`, `SECURE_COOKIE=True`,
  static 200); refusal on short secret
  (`[env] SESSION_SECRET must be set to at least 32 characters in production.
  Refusing to boot.`); fail-fast caveat in §8.

### Phase 5 — Tests + CI (`8b72f32`)
Vitest 5.0.5 + supertest, 3 files / 15 tests, real per-worker Postgres DBs
(`sanad_test_wN`), truncate per test; CI workflow (install, tsc, build,
migrate, tests, report-only audit).
- Created: `vitest.config.ts, tests/{setup,helpers,auth,authz-matrix,api}.test.ts,
  .github/workflows/ci.yml` — Modified: `package.json (test script),
  server/index.ts (P2003→404), validate.ts (defaults-free update schema)`
- Bugs found by the suite and fixed: parallel files sharing one DB (FK 500s) →
  per-worker DBs; matrix logout ordering → re-login; `.partial()` keeping
  `.default()`s defeating the non-empty refine → defaults-free schema.
- Result: **15/15 pass** (`Test Files 3 passed (3), Tests 15 passed (15)`).
- `npm audit --omit=dev`: 4 high, all inside the prisma dev-CLI chain
  (mysql2, deepmerge-ts via @prisma/config); runtime prod deps clean. CI step
  is report-only per spec (`|| true`).

### Phase 6 — Deployment + docs (this commit)
`Dockerfile` (multi-stage, non-root `sanad` user, prod-deps-only runtime,
HEALTHCHECK) + `.dockerignore`; compose `migrate` + `app` services; rewritten
`README.md`; `docs/HANDOVER.md`; this report.
- `docker compose up` end-to-end was **NOT verifiable here** (see §8).

## 2. Endpoint table

Auth = cookie session required. Ownership = store resolved server-side from
the session's merchant; mismatch → 403 (404 if store unknown).

| Method | Path | Auth | Ownership | Validation schema |
|--------|------|------|-----------|-------------------|
| GET | /api/health | no | — | — (200 + `db:up`, 503 + `db:down`) |
| POST | /api/auth/register | no + strict RL | creates own store | `registerSchema` |
| POST | /api/auth/login | no + strict RL | — | `loginSchema` |
| POST | /api/auth/logout | yes | own session row | — |
| GET | /api/auth/me | yes | — | — |
| POST | /api/auth/password | yes | self; kills other sessions | `changePasswordSchema` |
| GET | /api/stores | yes | own store(s) only | — |
| GET | /api/stores/:sub | no | public safe fields (no phone/plan) | `subdomainParamSchema` |
| GET | /api/account/store | yes | own | — |
| PATCH | /api/account/store | yes | own; subdomain immutable | `storeUpdateSchema` |
| GET | /api/stores/:sub/products | yes | owner | param + `paginationQuerySchema` |
| POST | /api/stores/:sub/products | yes | owner | param + `productBodySchema` |
| GET | /api/stores/:sub/products/:id | yes | owner | `productIdParamSchema` |
| PUT | /api/stores/:sub/products/:id | yes | owner | param + `productUpdateSchema` |
| DELETE | /api/stores/:sub/products/:id | yes | owner | `productIdParamSchema` |
| GET | /api/stores/:sub/orders | yes | owner | param + `orderListQuerySchema` |
| GET | /api/stores/:sub/orders/:id | yes | owner | `orderIdParamSchema` |
| PATCH | /api/stores/:sub/orders/:id/status | yes | owner + transition map | param + `orderStatusSchema` |
| POST | /api/stores/:sub/orders | yes | owner (manual entry) | param + `merchantOrderBodySchema` |
| POST | /api/stores/:sub/checkout | no + RL | server prices, not client | param + `checkoutBodySchema` |
| GET | /api/stores/:sub/summary | yes | owner | `subdomainParamSchema` |
| POST | /api/leads | no + RL | attributed if logged in | `leadBodySchema` |
| GET | /api/leads | yes | own store (all with admin token) | — |

RL = rate limit (auth 30/15min, public writes 60/15min). All bodies/params are
`.strictObject` (unknown fields → 400).

## 3. Authorization matrix results (from `tests/authz-matrix.test.ts`, passing)

| Endpoint | anonymous | other merchant | owner |
|----------|-----------|----------------|-------|
| GET /api/auth/me | 401 | 200 | 200 |
| POST /api/auth/logout | 401 | 200 | 200 |
| POST /api/auth/password | 401 | 200 | 200 |
| GET /api/stores | 401 | 200 (own only) | 200 |
| GET products / POST product / GET product / PUT product / DELETE product | 401 | 403 | 200/201/200/200/200 |
| GET orders / POST order / GET order / PATCH status | 401 | 403 | 200/201/200/200 |
| GET summary | 401 | 403 | 200 |
| GET /api/account/store / PATCH | 401 | 200 (own) | 200 |
| GET /api/leads | 401 | 200 (own scope) | 200 |
| GET /api/stores/:sub (public) | 200 safe fields | 200 | 200 |
| POST checkout / POST leads / GET health | 201/201/200 | — | — |

Plus: wrong password 401 (message identical to unknown-email), expired session
401 + row purged, logout → 401 after, change-password rotates others,
scrypt login rehashes to argon2id, demo creds rejected with DEMO off,
rate limit trips to 429 on the 31st rapid login.

## 4. Security-critical snippets

Auth middleware (`server/middleware.ts`): cookie → HMAC lookup → expiry →
merchant; missing/invalid → 401:
```ts
const sess = await prisma.session.findUnique({ where: { tokenHash } });
if (!sess || sess.expiresAt.getTime() <= Date.now()) { /* delete if stale */ next(401 SESSION_EXPIRED); }
```
Ownership (`requireStoreOwnership`): store resolved by `:subdomain`, then
`if (!auth.storeId || auth.storeId !== store.id) → 403 FORBIDDEN`.
Session create/rotate (`createSession` in `index.ts`): 256-bit token,
`prisma.session.create({ tokenHash: HMAC(token), expiresAt: +7d })`, cookie
set on register/login; logout deletes the row + clears cookie; password change
deletes all other rows.
Passwords (`server/auth.ts`): `argon2.hash(pw, {type: argon2id, memoryCost:
19456, timeCost: 2, parallelism: 1})`; legacy scrypt verifies via stored salt
then `needsRehash` triggers an argon2id upgrade inside login.
Cookie (`sessionCookieOptions`): `{httpOnly: true, sameSite: "lax",
secure: isProduction, path: "/", maxAge: 7d}` — verified `Secure` in prod boot.
CSRF (`csrfOriginCheck`): state-changing requests with `Origin`/`Referer`
outside `CORS_ORIGIN` → 403 (plus SameSite=Lax).
Zod example: `z.strictObject({email, password min 8, …})`; middleware maps
`error.issues` → `400 VALIDATION_ERROR` with field details.
Error handler: `ApiError(status, code, message)` → `{error:{code,message}}`;
unexpected → 500 `INTERNAL_ERROR`, stack only outside production; pino redacts
cookie/authorization/password fields.
Rate limiters: `rateLimit({windowMs: 15min, limit: 30|60,
standardHeaders: "draft-8", legacyHeaders: false})`; `trust proxy` from env.

## 5. DB schema and migrations

`prisma/schema.prisma`: `Store` (subdomain unique) 1—N `Merchant`
(email unique, `storeId?` SetNull), `Product` (@@unique[storeId,sku],
@@index[storeId]) 1—N `OrderItem`, `Order` (@@index[storeId],
@@index[storeId,status]) 1—N `OrderItem` (productId? SetNull),
`Lead(Json payload, storeId? SetNull)`, `Session(tokenHash @id,
merchantId Cascade, expiresAt indexed)`.
Migrations: `prisma/migrations/20261015133513_init/migration.sql` (+ lock
file). Seed: `prisma/seed.ts` (demo store+products+orders+merchant, argon2id).

## 6. Real command outputs

```
$ git log --oneline
8b72f32 test(security): integration suite with auth matrix + CI
78b42b0 chore(build): production-ready config, esbuild server bundle, cleanup
c2e7f8f feat(api): complete merchant API and wire frontend to real data
ba7bbbc feat(db): migrate from node:sqlite to PostgreSQL + Prisma
8e8ff7a feat(security): cookie sessions, argon2id, ownership checks, zod validation
53030db first commit
$ git diff --stat main  # 37 files, +6015/−1304 (see §1 for the list)
$ npx tsc --noEmit        # exit 0 (every phase)
$ npm run build           # vite build ok every phase (484 kB chunk warning only)
$ npm test                # Test Files 3 passed (3) / Tests 15 passed (15), ~11s
$ npm audit --omit=dev    # 4 high: mysql2 + deepmerge-ts, prisma dev-CLI chain only
$ dist greps              # GEMINI=0, demo-email=0, token/secret=0 matches
$ prod bundle boot        # HEALTH=True DB=up, PROD_LOGIN=200, SECURE_COOKIE=True, STATIC=200
$ short SESSION_SECRET    # "[env] SESSION_SECRET must be set to at least 32 characters
                            in production. Refusing to boot."
```

## 7. Decisions and assumptions

- Register creates store+merchant atomically (fixed a store-hijack vector;
  `POST /api/stores` removed; modal now collects account credentials).
- Subdomain immutable (no rename flow; prevents hijack/ وتعقيد).
- Single store per merchant in API/UI (schema allows more).
- Public storefront = store lookup + checkout only; console data needs login.
- Checkout totals in EGP from catalog; stock decremented transactionally.
- Order numbers stay readable (`SND-4825+N`) with P2002 retry, not UUIDs.
- Prisma 7 + `@prisma/adapter-pg` (7.10.0; ignored 8.0 RC upgrade notice).
- CI installs full deps (prisma CLI needed for migrate); runtime image is
  prod-deps-only; migrations run via CI/operator or compose `migrate` service.
- Tests assume local Postgres `sanad/sanad` (CI provides the service).

## 8. Not done / skipped / failed / unverified — blunt list

1. **`docker compose up` end-to-end NOT verified.** `docker build` first failed
   inside the daemon (`npm ci` exit 1, log lost to a broken pipe), then the
   Docker Desktop daemon became unstable (500s on every API route) while the
   C: disk hit 0 bytes free (freed 8.8 GB via `npm cache clean`; daemon still
   500s). The identical production artifact (`dist/` + `dist-server/server.cjs`)
   WAS verified with plain `node`. Treat the Dockerfile/compose as
   review-carefully-before-use.
2. **Fail-fast caveat:** empty-string `SESSION_SECRET` in local dev falls back
   to `.env` (dotenv never overrides set vars... observed: empty was treated as
   unset and filled from `.env`). Refusal WAS verified with a short secret.
   Production images contain no `.env`, so missing/weak secrets refuse boot.
3. **CI workflow never ran** (no runner here; pushes were forbidden). It should
   pass (same commands ran locally) but `npm ci` from lockfile on ubuntu +
   the Postgres service are unverified paths.
4. **No UI for order-status history/audit**, no product-image upload, no
   email flows, no admin UI — API-only or absent, see HANDOVER §8.
5. **Rate limits are per-instance memory** (documented; needs Redis for
   multi-replica).
6. **Dev database** (`sanad` on local Postgres) now contains seed + smoke-test
   rows; harmless locally, never ships (volumes are local). `npm run db:reset`
   wipes it.
7. Pre-existing chunk-size warning (484 kB JS) left as-is; no code-splitting
   pass was in scope.
