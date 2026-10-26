# Sanad Commerce — Comprehensive Audit and Remediation Report

**Audit date:** 2026-10-26  
**Repository:** `D:\سند-للتجارة-_-sanad-commerce`  
**Auditor:** Independent code and regression audit  
**Final verdict:** **NOT READY** for production  
**Report path:** `SANAD_COMPREHENSIVE_AUDIT_REPORT.md`

---

## 1. Executive Summary

This audit re-verified the prior discovery findings against the working tree, fixed confirmed source-level defects, and added regression coverage. The working tree was preserved; no reset, clean, commit, push, migration, seed, restore, payment, refund, email, DNS, or production operation was performed.

The tested application paths are substantially improved:

- Checkout idempotency is now bound to the immutable request payload.
- Public checkout returns an explicit shopper-safe allowlist instead of the Prisma order row.
- Draft/inactive products and variants are rejected at checkout.
- Conflicting customer phone/email identities are no longer merged.
- Verified custom-domain origins work for CORS/CSRF without being trusted for platform-admin APIs.
- Media uploads require `operations.write`; read-only roles can list but not publish media.
- Docker uploads use a named volume instead of the ephemeral container layer.
- Administrator initial credentials now require the current password, reject reuse, and require 12 characters.
- DNS verification challenges are hidden from read-only administrators and store-settings responses.
- Reports and dashboard revenue subtract processed refunds; top-product revenue is also netted.
- Malformed and oversized JSON bodies return stable client errors.
- Subscription approval validates plan, currency, and amount.
- Destructive reset/restore scripts have explicit confirmation and target guards.
- CI builds the server bundle and validates the Prisma schema.

The application is still **not production-ready** because:

1. The bootstrap administrator password remains in Git history and must be treated as compromised until rotated and purged.
2. Mandatory administrator MFA is not enforced.
3. Monetary values remain `Float` rather than exact decimal values.
4. Account deletion hard-deletes store and order history without a retention decision.
5. Checkout still does not require phone/address server-side.
6. Stores with shipping zones now reject unmatched addresses, but stores with no zones still ship free by fallback policy.
7. The admin-credential migration is untracked and has not been applied to a target database.
8. No restore drill, live browser test, DNS/TLS test, or external integration test was performed.

**Final test evidence:** `28` test files, `181` tests, all passing; `npm run lint`, `npm run build`, `npm run build:server`, and `npx prisma validate` all pass.

---

## 2. Scope and Constraints

### In scope

- Source review of authentication, sessions, admin/RBAC, checkout, payments/refunds, reports, shipping, custom domains, media, validation, error handling, seed data, deployment files, CI, and destructive maintenance scripts.
- Behavioral API tests against isolated local PostgreSQL databases.
- Regression tests for each confirmed remediation.
- Documentation of unresolved product, migration, and operational decisions.

### Out of scope / not performed

- No production or staging database access.
- No live browser, mobile, DNS, TLS, SMTP, SMS, payment-gateway, or webhook verification.
- No migration, seed, reset, restore, backup, payment, refund, email, or DNS mutation against a running system.
- No commit, push, history rewrite, release, or deployment.
- No secrets, credentials, tokens, or `.env` contents were printed.
- No security scanning of third-party dependencies beyond the existing CI report-only `npm audit` step.

### Working-tree rule

The tree already contained user changes at baseline. Those changes were treated as the audit baseline and were not reset. Remediation edits were additive and are intentionally uncommitted.

---

## 3. Git Baseline and Working Tree

### Exact Git baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `139ffebbfeedd6ee06949911d87cc35725cc0ecc` |
| HEAD subject | `security: remove exposed admin password and add recovery tool` |
| Upstream | `origin/main` at the same commit |
| Baseline tracked modifications | `29` |
| Baseline untracked items | `3` |
| Baseline staged changes | `0` |

Baseline untracked items:

- `docs/LAUNCH_READINESS.md`
- `prisma/migrations/20261026150000_admin_initial_credentials/`
- `tests/phase6-ux.test.ts`

### Final working-tree state

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `139ffebbfeedd6ee06949911d87cc35725cc0ecc` |
| Tracked modifications | `51` |
| Untracked items | `5` (including this report) |
| Staged changes | `0` |
| `git diff --check` | exit `0`; only LF/CRLF informational warnings |

Final untracked items:

- `docs/LAUNCH_READINESS.md` (baseline)
- `prisma/migrations/20261026150000_admin_initial_credentials/` (baseline)
- `tests/phase6-ux.test.ts` (baseline)
- `tests/audit-remediation.test.ts` (added by this audit)
- `SANAD_COMPREHENSIVE_AUDIT_REPORT.md` (this deliverable)

The increase from 29 to 51 tracked modifications reflects remediation edits and files that also contained pre-existing user changes. No file was reverted or cleaned.

### Git history exposure

The repository history contains commits whose messages reference admin-password handling:

- `fb60ffc add the password for admin`
- `139ffeb security: remove exposed admin password and add recovery tool`

History was **not** rewritten. The final tree and `.env.example` no longer contain the bootstrap values, but the historical objects remain. This is tracked as **C1**.

### Report-file check

`SANAD_COMPREHENSIVE_AUDIT_REPORT.md` did not exist before this report was written. It was created only after the final validation pass.

---

## 4. Environment and Test Isolation

| Component | Observed value |
|---|---|
| Node.js | `v24.16.0` |
| npm | `11.13.0` |
| Docker | `29.7.2`, build `a7dcaa6` |
| Development database | `sanad-commerce-db-1` on port `5432` |
| Verification database | `sanad-verify-db-1` on port `5433` |
| Test databases | Isolated `sanad_test_*` databases created per Vitest worker |
| Test connection source | `TEST_DATABASE_URL`; default local fallback for developer machines |

The test setup now derives the administrative connection from `TEST_DATABASE_URL` rather than hardcoding port `5432`. Test database names are restricted to the `sanad_test_` prefix, and the setup truncates test tables before each suite.

No test or command targeted the development store data or the running application.

---

## 5. Method and Evidence

1. **Static review:** traced route → middleware → service → Prisma paths and reviewed schema, env validation, Docker/Compose, CI, scripts, and frontend callers.
2. **Behavioral verification:** used Supertest against the real Express app and isolated PostgreSQL test databases.
3. **Negative testing:** invalid idempotency keys, inactive products, conflicting identities, unmatched shipping zones, unknown origins, viewer uploads, malformed JSON, oversized bodies, invalid subscription payments, and unsafe restore/reset targets.
4. **Regression tests:** added `tests/audit-remediation.test.ts` with 15 tests and updated existing tests affected by the changed contracts.
5. **Static checks:** TypeScript, frontend build, server bundle, Prisma validation, and `git diff --check`.

No finding in this report relies solely on a prior narrative. Each status below was re-derived from the current code and/or an executed test.

---

## 6. Prior Finding Status Matrix

The original discovery report was supplied as prior context rather than as a repository file. The IDs below are the prior audit IDs. Where the original title could not be recovered exactly, the row states the independently verified behavior instead of asserting the original wording.

| ID | Verified issue | Status | Evidence / note |
|---|---|---|---|
| **C1** | Bootstrap admin credentials exposed in the template and Git history | **OPEN (operational)** | `.env.example` values blanked; history commits remain; local `.env` still has bootstrap values; rotation/purge not performed |
| **H1** | Checkout idempotency could replay the wrong order; public response overexposed internal order fields | **FIXED** | Payload-bound replay + explicit public DTO; tests |
| **H2** | Draft/inactive products or variants could be purchased | **FIXED** | `resolveCheckoutLines` filters active product and variant; test |
| **H3** | Conflicting phone/email identities could be merged | **FIXED** | Phone-primary deterministic resolution; no merge; test |
| **H4** | Verified custom domains failed CORS/CSRF, breaking checkout | **FIXED** | Verified + published store domains trusted; preflight and POST tests |
| **H5** | Any authenticated team role could upload/list media | **FIXED** | Upload requires `operations.write`; list requires `store.read`; test |
| **H6** | Uploads were lost when the app container was replaced | **FIXED** | `sanad-uploads` named volume, writable directory, `STORAGE_DIR` |
| **H7** | TOTP secrets fall back to a `SESSION_SECRET`-derived key | **PARTIAL** | Boot warning added; dedicated key remains optional; no migration |
| **H8** | Unmatched shipping zones silently used zero shipping; checkout contact fields not server-required | **PARTIAL** | Configured-store mismatch now `409`; no-zone free fallback and server contact policy remain product decisions |
| **H9** | Account deletion hard-deletes store and financial/audit history | **OPEN** | Source review only; retention/soft-delete policy not changed |
| **H10** | Custom-domain trust boundary was too broad, including admin-risk surface | **FIXED** | Only verified, published store domains; custom domains explicitly excluded from `/api/admin` |
| **H11** | Restore could fall back to `DATABASE_URL`, use unsafe manifest paths, or run in production against the wrong target | **FIXED (drill pending)** | Explicit target, protocol/maintenance guards, path containment, production/same-DB guards; no live restore drill |
| **H12** | Shared bootstrap credentials and optional administrator MFA | **PARTIAL** | Current-password check, reuse rejection, 12-character minimum; mandatory MFA still open |
| **M1** | Domain verification token exposed to read-only admins and settings | **FIXED** | `domains.write` required to see challenge; settings strip token; test |
| **M2** | Admin credential replacement did not require current password or reject reuse | **FIXED** | Server checks current password and Argon2 reuse; tests |
| **M3** | Reports/dashboard revenue ignored processed refunds | **FIXED** | Net revenue, refund totals, series, top products; test |
| **M4** | Malformed or oversized JSON produced opaque errors | **FIXED** | `INVALID_JSON` / `PAYLOAD_TOO_LARGE`; test |
| **M5** | Admin credential migration is not committed/deployed | **OPEN (repository/deploy)** | Migration exists as an untracked baseline item; no target migration applied |
| **M6** | CI did not build the server bundle or validate Prisma | **FIXED** | CI steps added |
| **M7** | Admin password policy/UI/API mismatch (8/10/12) | **FIXED** | 12-character policy enforced server-side and in admin UI; tests |
| **M8** | Free-shipping coupon could still show a nonzero shipping quote | **FIXED** | Public quote zeroed when coupon grants free shipping; test |
| **M9** | Subscription approval accepted invalid plan/currency/amount | **FIXED** | Plan, currency, and price validation; test |
| **M10** | Demo seed left the store unpublished/incomplete | **FIXED** | Seed publishes store and marks onboarding complete |
| **L1** | Dev reset only checked `NODE_ENV`, allowing remote/maintenance resets | **FIXED** | Explicit confirmation, protocol/local-host/maintenance guards |
| **L2** | Test setup hardcoded local PostgreSQL admin connection | **FIXED** | Derives from `TEST_DATABASE_URL` |
| **L3** | Test-generated uploads polluted the working tree | **FIXED** | `data/uploads/` added to `.gitignore`; generated test directories removed |
| **L4** | Documentation drift for destructive/restore commands | **PARTIAL** | README updated; untracked `docs/LAUNCH_READINESS.md` still lacks the explicit `RESTORE_DATABASE_URL` requirement |

**Status key:** `FIXED` = code and regression test verified; `FIXED (drill pending)` = code verified but operational drill not run; `PARTIAL` = mitigation present but a product/migration decision remains; `OPEN` = not remediated.

---

## 7. Critical Findings

### C1 — Bootstrap administrator credential exposure

**Status: OPEN (operational).**

**What was verified**

- `.env.example` originally carried concrete bootstrap administrator values.
- The values were blanked in `.env.example` during remediation.
- The local `.env` still contains live bootstrap values. The values were never printed and were not used.
- Git history still contains the earlier password-bearing commit and the later “remove exposed password” commit.
- A source scan found no remaining non-empty bootstrap values outside `.env`; the scan reported file names and lengths only.

**Why this remains critical**

A repository secret is compromised once it has entered shared history. Removing it from the current checkout does not revoke it, invalidate sessions, or remove it from clones, caches, CI artifacts, or forks. Until rotation and history coordination are complete, an attacker with access to the repository history may be able to authenticate as the bootstrap administrator.

**Required actions**

1. Rotate the bootstrap administrator password immediately.
2. Sign the administrator out everywhere and revoke all admin sessions.
3. Remove the bootstrap email/password from the deployed environment after the account is secured.
4. Treat the old value as burned. Rewrite history only after coordinating with all clones and CI; force-push and require re-clone.
5. Run secret scanning over history and all branches.
6. Review audit logs for use of the bootstrap account.
7. If there is any indication the value was reused for another service, rotate that service too.

The report deliberately does not reproduce the value.

---

## 8. High Findings

### H1 — Checkout idempotency and public order exposure

**Status: FIXED.**

- `checkoutRequestMatches` compares the stored order’s items, customer fields, address fields, payment method, coupon, shipping zone, and notes.
- Reusing an idempotency key with a changed cart returns `409 IDEMPOTENCY_KEY_REUSED` instead of returning an unrelated order.
- The unique index remains the race guard; the conflict path also validates the request before replay.
- `variant_id` is normalized as an alias for `variantId`.
- Public checkout now returns an explicit allowlist: order number, statuses, amounts, customer name, timestamps, safe item fields, and a safe shipping quote.
- Internal order/store/customer IDs, idempotency key, contact details, address, notes, source, stock-restoration flags, and zone ID are no longer exposed.
- Tests cover replay, changed-payload rejection, stock decrement, and response keys.

**Intentional contract change:** clients must use `orderNumber` (and the tracking token) rather than the internal order ID after public checkout.

### H2 — Inactive/draft catalog purchasable

**Status: FIXED.**

- Checkout product query is limited to `status: "active"`.
- Variant query joins to an active product and checks `variant.isActive`.
- Inactive/draft products produce `UNKNOWN_SKU`; tests cover this.

### H3 — Customer identity merge

**Status: FIXED.**

- Phone is the primary identifier; email is secondary.
- If phone and email resolve to different existing customers, the order attaches to the phone match and the email record is not merged or overwritten.
- Advisory locks are taken for both normalized phone and email in sorted order.
- Test verifies both existing customer rows remain distinct.

### H4 — Custom-domain CORS/CSRF

**Status: FIXED.**

- A single trust helper accepts configured platform origins and verified custom domains attached to active, published stores.
- Production custom domains must use HTTPS.
- CORS preflight is answered for trusted origins; unknown origins receive `403 CORS_ORIGIN_REJECTED`.
- CSRF uses the same trust decision and does not weaken the production source requirement.
- Custom domains are explicitly not trusted for `/api/admin` CORS or CSRF, so a merchant-controlled origin cannot become a platform-admin origin.
- Tests cover trusted checkout, preflight, unknown origin, and admin-origin rejection.

### H5 — Media RBAC

**Status: FIXED.**

- `POST /api/media` requires `operations.write`.
- `GET /api/media` requires `store.read`.
- Viewer upload is rejected; staff upload succeeds; viewer can list.
- The media limiter remains in place.

### H6 — Upload persistence

**Status: FIXED.**

- `docker-compose.yml` mounts `sanad-uploads` at `/app/data/uploads`.
- The runtime sets `STORAGE_DIR=/app/data/uploads`.
- The Dockerfile creates the directory and assigns ownership before dropping to the non-root user.
- This removes the previous container-layer storage loss mode.

### H7 — TOTP encryption key

**Status: PARTIAL.**

- If `TOTP_ENCRYPTION_KEY` is absent, TOTP secrets are derived from `SESSION_SECRET`.
- A production boot warning now states that rotating `SESSION_SECRET` invalidates administrator MFA in that configuration.
- A dedicated key remains optional; no key migration or mandatory rollout was performed.
- Setting a dedicated key after TOTP enrollment requires a migration/re-enrollment plan.

### H8 — Shipping and checkout contact policy

**Status: PARTIAL.**

- When a store has active shipping zones and none match the address, checkout now fails with `409 SHIPPING_ZONE_UNAVAILABLE` instead of silently charging zero.
- Stores with no active zones still retain the explicit free-shipping fallback. This is a product decision, not a silent code failure.
- `customer_phone` and `address` remain optional at the server schema layer; the storefront requires them, but a direct API client can omit them.
- The free-shipping coupon response is now zeroed consistently with the order total.

### H9 — Account deletion and retention

**Status: OPEN.**

- `DELETE /api/account` verifies the password, deletes sessions and the merchant, and deletes the store when no merchants remain.
- Store deletion cascades through store-owned orders, customers, and related records.
- There is no soft-delete, legal-hold, export-before-delete, or financial-retention policy in code.
- This requires a product/legal decision before production use.

### H10 — Custom-domain trust boundary

**Status: FIXED.**

- Only a verified custom domain attached to an active, published store is accepted.
- Suspended/unpublished stores no longer inherit origin trust.
- Admin routes remain platform-origin-only.
- The policy is centralized in `server/services/domains.ts` and reused by CORS and CSRF.

### H11 — Backup/restore safety

**Status: FIXED (restore drill pending).**

- Restore requires explicit `RESTORE_DATABASE_URL`; it no longer silently falls back to `DATABASE_URL`.
- It requires `CONFIRM_RESTORE=yes`.
- It rejects non-PostgreSQL URLs and the `postgres` maintenance database.
- It rejects unsafe manifest paths outside the backup directory.
- It requires `ALLOW_PRODUCTION_RESTORE=yes` when `NODE_ENV=production`.
- It requires `ALLOW_SAME_DATABASE_RESTORE=yes` if the explicit target equals `DATABASE_URL`.
- No restore was run against a real or staging database.

### H12 — Bootstrap credentials and MFA

**Status: PARTIAL.**

- Initial credential replacement now requires the current setup password, rejects the same password, and requires 12 characters.
- The admin UI and API client were updated.
- The normal admin password-change path also rejects reuse.
- Administrator MFA remains optional; there is no enforced enrollment requirement.
- Disabled-bootstrap recovery remains an operational gap: if the only administrator is disabled, the bootstrap helper does not restore access.

---

## 9. Medium Findings

### M1 — Domain verification token visibility

**Status: FIXED.**

- `GET /api/admin/domains` hides `verificationToken` unless the caller has `domains.write`.
- Admin store-settings responses strip the token for all callers.
- Merchant domain APIs already sanitize the row and return a one-time challenge separately.
- Test covers readonly vs writer vs settings.

### M2 — Admin credential replacement checks

**Status: FIXED.**

- Current password is verified before the initial credential change.
- New password must differ from the current password.
- Argon2 reuse verification is used in addition to schema equality checks.
- Tests cover missing current password, wrong current password, short password, reuse, and success.

### M3 — Refund-adjusted revenue

**Status: FIXED.**

- Reports include processed refunds, expose `grossRevenue`, `refunds`, and `revenue`, and net the series.
- Dashboard nets processed refunds from total sales, month sales, revenue series, and top products.
- Top-product refund allocation is proportional to order value; it is an approximation, not a per-line refund ledger.
- Test covers report totals, dashboard KPIs, and top-product revenue after a partial refund.

### M4 — JSON parser errors

**Status: FIXED.**

- `entity.parse.failed` and SyntaxError bodies return `400 INVALID_JSON`.
- `entity.too.large` returns `413 PAYLOAD_TOO_LARGE`.
- Test covers both.

### M5 — Admin credential migration

**Status: OPEN (repository/deployment).**

- `prisma/migrations/20261026150000_admin_initial_credentials/migration.sql` exists but is untracked.
- The audit did not apply migrations to any target database.
- This migration must be committed and deployed before the `mustChangeCredentials` code path can run in a clean environment.

### M6 — CI coverage

**Status: FIXED.**

- CI now runs `npm run build:server` and `npx prisma validate` in addition to TypeScript, frontend build, migrate deploy, generate, and tests.

### M7 — Admin password length

**Status: FIXED.**

- Server admin password minimum is 12.
- Admin UI creation, initial credential setup, and normal password change all validate 12.
- Tests cover the server contract.

### M8 — Free-shipping quote mismatch

**Status: FIXED.**

- When a coupon grants free shipping, the public shipping quote is returned with zero fee, zero COD fee, zero total, and `freeShippingApplied: true`.
- The persisted order shipping fee remains zero.
- Test covers the quote and order total.

### M9 — Subscription approval validation

**Status: FIXED.**

- Plan must be `monthly` or `annual`.
- Currency must be `EGP`.
- Amount must match the configured plan price within `0.01`.
- Tests cover invalid currency, invalid amount, and successful approval.
- Strict price matching may reject legitimate promotional pricing; that is a product policy decision.

### M10 — Demo seed state

**Status: FIXED.**

- The demo store is created as `published`.
- `publishedAt` and `onboardingCompleted` are set.
- The seed still refuses production unless explicitly enabled with a demo password.

---

## 10. Low Findings

### L1 — Destructive reset guard

**Status: FIXED.**

- `db:reset` now requires `CONFIRM_DB_RESET=yes`.
- It refuses production.
- It rejects non-PostgreSQL URLs and non-local hosts.
- It rejects the `postgres` maintenance database.
- It handles bracketed IPv6 localhost.

### L2 — Test database portability

**Status: FIXED.**

- Test setup derives both the target database and the administrative connection from `TEST_DATABASE_URL`.
- It keeps the `sanad_test_` name guard.

### L3 — Test upload pollution

**Status: FIXED.**

- `data/uploads/` is ignored going forward.
- Test-generated directories created during this audit were removed.
- The final tree has five untracked items: three original items, the new audit test, and this report.

### L4 — Documentation drift

**Status: PARTIAL.**

- `README.md` now documents the reset confirmation and the explicit restore requirements.
- `docs/LAUNCH_READINESS.md` is an untracked baseline document and still shows the old restore invocation without `RESTORE_DATABASE_URL`; it should be updated before use.
- `agent.md` retains an older one-line restore example; it is a planning document.

---

## 11. Additional Findings

These were found during remediation or final review.

| ID | Finding | Status | Resolution / residual |
|---|---|---|---|
| A1 | Custom-domain trust initially applied to `/api/admin` as well as storefront APIs | **FIXED** | CORS/CSRF now exclude custom domains from admin routes; test added |
| A2 | Free-shipping coupon left a nonzero public shipping quote | **FIXED** | Quote zeroed; test added |
| A3 | Top-product revenue was gross while total revenue was net | **FIXED** | Reports and dashboard net refunds proportionally |
| A4 | Restore accepted non-PostgreSQL URLs | **FIXED** | Protocol validated |
| A5 | Reset/restore maintenance-database and path edge cases | **FIXED** | `postgres` paths and manifest traversal rejected |
| A6 | Test uploads were not ignored and polluted status | **FIXED** | `.gitignore` updated; generated dirs removed |
| A7 | Disabled bootstrap administrator has no environment-based recovery | **OPEN** | Requires an operator procedure or a product decision; not changed |
| A8 | `CORS_ORIGIN` accepts malformed values; production HTTPS is not validated for platform origins | **OPEN (config)** | Misconfiguration fails closed for custom domains; document and validate deployment config |
| A9 | `TRUST_PROXY` defaults to false; rate limiting and audit IPs can be wrong behind a proxy | **OPEN (deployment)** | Set `TRUST_PROXY` correctly and verify forwarded headers at the edge |
| A10 | No restore drill or live custom-domain/browser test | **OPEN (verification)** | Run on staging before release |
| A11 | Refund allocation to top products is proportional, not line-level | **RESIDUAL** | Documented approximation; line-level refunds would be a schema/product change |
| A12 | Public checkout no longer returns `order.id` | **INTENTIONAL** | Clients must use `orderNumber`/tracking token; tests updated |

---

## 12. Remediation Changes

All remediation changes are uncommitted.

### Checkout, orders, and public contract

- `server/services/checkout.ts`
  - Payload-bound idempotency replay and `IDEMPOTENCY_KEY_REUSED`.
  - `variant_id` alias normalization.
  - Active product/variant enforcement.
  - Phone-primary identity resolution without cross-record merges.
  - Phone/email advisory locks.
  - Shipping-zone mismatch rejection.
  - Free-shipping quote/total consistency.
- `server/routes/storefront.ts`
  - Explicit public checkout order DTO.
  - Explicit public shipping DTO.
  - `CHECKOUT_ORDER_MISSING` guard.
- `tests/helpers.ts`
  - `orderIdByNumber()` for tests that need the internal ID without exposing it publicly.

### Origins, admin, and RBAC

- `server/services/domains.ts`
  - `normalizeOrigin()` and `isTrustedStorefrontOrigin()`.
  - Verified + published + active store requirement.
- `server/middleware.ts`
  - CORS guard for platform and verified custom origins.
  - Custom-domain exception scoped away from `/api/admin`.
  - Async CSRF check using the same trust policy.
- `server/index.ts`
  - Replaced the `cors` package middleware with the audited guard.
- `server/routes/media.ts`
  - `operations.write` for upload; `store.read` for listing.
- `server/routes/admin.ts`
  - Domain challenge visibility gated by `domains.write`.
  - Store-settings token removal.
  - Initial credential current-password/reuse checks.
  - Normal admin password reuse check.
  - Subscription plan/currency/amount validation.
  - Admin creation minimum 12 characters.
- `server/validate.ts`
  - Dedicated 12-character admin password field and schemas.
- `src/admin/AdminApp.tsx`, `src/admin/AdminOps.tsx`, `src/lib/api.ts`
  - Current password field and 12-character UI validation.

### Financial reporting

- `server/routes/reports.ts`
  - Processed-refund totals, net revenue, net series, net top customers and top products.
- `server/routes/dashboard.ts`
  - Net total/month/series revenue and net top products.

### Errors and configuration

- `server/errors.ts`
  - Stable `INVALID_JSON` and `PAYLOAD_TOO_LARGE` responses.
- `server/env.ts`
  - Production warning for missing `TOTP_ENCRYPTION_KEY`.

### Deployment, seed, and operations

- `Dockerfile`
  - Creates writable `/app/data/uploads` before dropping privileges.
- `docker-compose.yml`
  - `sanad-uploads` named volume and `STORAGE_DIR`.
- `prisma/seed.ts`
  - Publishes demo store and completes onboarding.
- `.env.example`
  - Bootstrap credential template values blanked. Values were never printed.
- `.github/workflows/ci.yml`
  - Server build and Prisma validation.
- `scripts/restore.mjs`
  - Explicit target, protocol/maintenance/path/production/same-DB guards.
- `scripts/db-reset.mjs`
  - Explicit confirmation, local-host/protocol/maintenance guards.
- `.gitignore`
  - `data/uploads/` ignored.
- `README.md`
  - Destructive-operation commands documented.

### Tests

- New `tests/audit-remediation.test.ts`.
- Updated `tests/phase1-integrity.test.ts`, `tests/phase4-admin-bootstrap.test.ts`, `tests/order-fields.test.ts`, `tests/order-numbers.test.ts`, `tests/order-status.test.ts`, and `tests/setup.ts`.

---

## 13. Regression Tests Added

`tests/audit-remediation.test.ts` contains 15 tests:

1. Public checkout DTO allowlist and absence of internal/contact fields.
2. Inactive product rejection.
3. Conflicting phone/email identity isolation.
4. Shipping-zone mismatch rejection.
5. Free-shipping coupon quote/order consistency.
6. Verified custom-domain CORS/CSRF and preflight.
7. Unknown-origin rejection.
8. Custom domain not trusted for platform-admin routes.
9. Viewer media upload denial and read-only listing.
10. Read-only admin domain-token hiding and settings stripping.
11. Refund-adjusted reports, dashboard, and top products.
12. Malformed JSON error mapping.
13. Oversized JSON error mapping.
14. Subscription currency/amount validation and approval.
15. Deployment configuration guards (uploads volume, Docker writable dir, CI server build/Prisma validation, blank bootstrap template).

Existing tests updated for the new public checkout contract, idempotency behavior, and admin credential contract.

**Full suite:** `28` files, `181` tests, `181` passed, exit `0`.

---

## 14. Commands and Results

| Command | Result |
|---|---|
| `git rev-parse --abbrev-ref HEAD` | `main` |
| `git rev-parse HEAD` | `139ffebbfeedd6ee06949911d87cc35725cc0ecc` |
| `git status --porcelain=v1` | 51 modified, 5 untracked, 0 staged |
| `git diff --check` | exit `0`; LF/CRLF warnings only |
| `npm test` | 28 files, 181 tests passed, exit `0`, 359.94s |
| `npx vitest run tests/audit-remediation.test.ts tests/phase1-integrity.test.ts` | 27 tests passed |
| `npm run lint` (`tsc --noEmit`) | exit `0` |
| `npm run build` | Vite production build succeeded, 1741 modules, exit `0` |
| `npm run build:server` | esbuild server bundle succeeded, 473.9 KB, exit `0` |
| `npx prisma validate` | schema valid |
| `node --version` | `v24.16.0` |
| `npm --version` | `11.13.0` |
| `docker --version` | `29.7.2`, build `a7dcaa6` |

Notes:

- The full test log contains expected negative-path `503` logs and PostgreSQL client deprecation warnings; the suite exited successfully.
- The frontend build reports a non-blocking Vite warning about `__dirname` and the planned native config loader. It did not fail the build.
- `npm run lint` and `npm run build:server` were initially started in parallel once; `tsc` read the server bundle while it was being written and reported transient syntax errors. A clean sequential rerun passed. This is a tooling race, not a source defect.

---

## 15. Verification Matrix

| Area | Verification |
|---|---|
| Checkout replay | Same-key replay test; changed-cart `409` test; stock count check |
| Public DTO | Exact response-key assertions; absence of internal IDs/contact/source/idempotency |
| Catalog status | Draft product checkout returns `UNKNOWN_SKU` |
| Identity | Two customer rows remain distinct after conflicting checkout |
| Shipping | Unmatched configured zone returns `SHIPPING_ZONE_UNAVAILABLE`; free-shipping coupon quote is zero |
| Origins | Preflight 204 + ACAO; checkout 201 with verified origin; unknown origin 403; admin origin 403 |
| Media | Viewer upload 403; staff upload 201; viewer list 200 |
| Admin tokens | Readonly list hides token; writer list shows token; settings never contains challenge |
| Refunds | Report/dashboard totals and top product net revenue after a processed partial refund |
| JSON | Malformed 400 `INVALID_JSON`; oversized 413 `PAYLOAD_TOO_LARGE` |
| Subscriptions | Invalid currency/amount rejected; exact amount approved |
| Admin credentials | Missing/wrong/short/reused rejected; valid replacement succeeds |
| Deployment | Compose volume, Docker writable path, CI steps, blank bootstrap template |
| Static | TypeScript, frontend build, server build, Prisma schema validation |

---

## 16. Unresolved Product and Migration Decisions

These items were deliberately not forced because they change product behavior, legal posture, or stored-data formats.

1. **Mandatory administrator MFA.** Decide whether all platform admins must enroll and whether enrollment is required before the first privileged action.
2. **Exact money storage.** Migrate `Float` monetary fields to `Decimal` or integer minor units; define rounding and reporting behavior.
3. **TOTP key migration.** Choose a dedicated `TOTP_ENCRYPTION_KEY` rollout and migrate/re-enroll existing secrets before rotating `SESSION_SECRET`.
4. **Account deletion and retention.** Define soft-delete, export, legal-hold, and financial-record retention.
5. **No-zone shipping.** Decide whether stores with no zones ship free or must configure a fallback zone.
6. **Server-side checkout requirements.** Decide whether phone and address must be mandatory at the API layer, not just the storefront.
7. **Subscription pricing flexibility.** Current strict amount validation rejects promotional or manually negotiated prices; decide whether admin override is needed.
8. **Disabled bootstrap recovery.** Define an operator runbook or a controlled recovery command for a disabled sole administrator.
9. **Email verification policy.** Decide whether production registration must require verified email; SMTP is optional unless the flag is enabled.
10. **Git-history remediation policy.** Coordinate history rewrite, force-push, fork/clone invalidation, and secret scanning.

---

## 17. Operational Security Actions Required

These are release gates, not code-only tasks.

1. **Rotate the bootstrap admin password** and any credential that may have been reused.
2. **Revoke all admin sessions** after rotation.
3. **Remove bootstrap values from deployed environment configuration** once the account is secured.
4. **Rewrite Git history** only with team coordination; force-push and require re-clone. Assume old clones are compromised.
5. **Run secret scanning** across all branches and tags.
6. **Set `TOTP_ENCRYPTION_KEY` before rotating `SESSION_SECRET`**, or plan administrator MFA re-enrollment.
7. **Enforce MFA** if that is the production policy.
8. **Commit and deploy the admin-credentials migration**.
9. **Run a backup/restore drill on staging** with the new explicit target flags.
10. **Set `TRUST_PROXY` correctly** and verify client IPs at the edge so rate limits and audit logs are accurate.
11. **Validate `CORS_ORIGIN`** values and use HTTPS in production.
12. **Review admin audit logs** for historical use of the bootstrap account.

No secret values are included in this report.

---

## 18. Outstanding Risks and Limitations

| Risk | Severity | Status |
|---|---|---|
| Bootstrap credential in Git history / local `.env` | Critical | Open until rotated and history coordinated |
| Mandatory admin MFA absent | High | Open product/security decision |
| Float monetary storage and rounding | High | Open migration decision |
| Hard-delete of store/order history | High | Open product/legal decision |
| Server-side checkout phone/address optional | Medium | Open product decision |
| No-zone free shipping fallback | Medium | Open product decision |
| TOTP key derived from session secret | Medium | Partial; warning only |
| Admin migration untracked/unapplied | High deployment | Open |
| No restore drill | High operational | Not performed |
| No live custom-domain/DNS/TLS/browser test | Medium | Not performed |
| Disabled sole-admin recovery | Medium | Open runbook |
| `CORS_ORIGIN`/`TRUST_PROXY` misconfiguration | Medium | Deployment checklist |
| Proportional refund allocation for top products | Low | Documented approximation |
| Email/SMS/payment gateway behavior | Unknown | Out of scope |

**No production or staging environment was changed.** The tested conclusions apply to the checked-out source and isolated test databases, not to a live deployment.

---

## 19. Production-Readiness Verdict

### Verdict: NOT READY

The source tree passes the full local regression suite and the tested remediation paths are materially safer. However, “all tests pass” is not equivalent to production readiness.

The blocking reasons are:

- A known administrator secret remains in Git history and local environment configuration until operational rotation and history coordination are completed.
- Administrator MFA is optional.
- Monetary values are still floating point.
- Account deletion destroys financial/audit history without an approved retention policy.
- The admin-credentials migration is not committed/deployed.
- Checkout contact requirements and no-zone shipping remain product decisions.
- No restore drill or live custom-domain/browser validation has been performed.

**Minimum path to `CONDITIONALLY READY` for a limited release:**

1. Rotate and revoke the exposed administrator credential; remove it from deployment environment.
2. Commit and deploy the admin-credentials migration.
3. Complete a staging restore drill.
4. Pass a live browser/custom-domain smoke test.
5. Approve or explicitly defer MFA, money precision, account deletion, checkout contact, and no-zone shipping policies.

**Minimum path to `READY FOR PRODUCTION`:** the above, plus mandatory MFA or an equivalent compensating control, exact money storage, approved retention/deletion behavior, and a clean secret-history posture.

---

## 20. JSON Summary

```json
{
  "audit": {
    "date": "2026-10-26",
    "repository": "D:\\سند-للتجارة-_-sanad-commerce",
    "branch": "main",
    "head": "139ffebbfeedd6ee06949911d87cc35725cc0ecc",
    "baseline_tracked_modifications": 29,
    "baseline_untracked": 3,
    "final_tracked_modifications": 51,
    "final_untracked": 5,
    "staged": 0,
    "report_created_new": true
  },
  "validation": {
    "test_files": 28,
    "tests": 181,
    "tests_passed": 181,
    "tests_failed": 0,
    "test_exit_code": 0,
    "lint": "pass",
    "frontend_build": "pass",
    "server_build": "pass",
    "prisma_validate": "pass",
    "git_diff_check": "pass"
  },
  "prior_findings": {
    "C1": "OPEN_OPERATIONAL",
    "H1": "FIXED",
    "H2": "FIXED",
    "H3": "FIXED",
    "H4": "FIXED",
    "H5": "FIXED",
    "H6": "FIXED",
    "H7": "PARTIAL",
    "H8": "PARTIAL",
    "H9": "OPEN",
    "H10": "FIXED",
    "H11": "FIXED_DRILL_PENDING",
    "H12": "PARTIAL",
    "M1": "FIXED",
    "M2": "FIXED",
    "M3": "FIXED",
    "M4": "FIXED",
    "M5": "OPEN_MIGRATION",
    "M6": "FIXED",
    "M7": "FIXED",
    "M8": "FIXED",
    "M9": "FIXED",
    "M10": "FIXED",
    "L1": "FIXED",
    "L2": "FIXED",
    "L3": "FIXED",
    "L4": "PARTIAL"
  },
  "additional_findings": {
    "A1": "FIXED",
    "A2": "FIXED",
    "A3": "FIXED",
    "A4": "FIXED",
    "A5": "FIXED",
    "A6": "FIXED",
    "A7": "OPEN",
    "A8": "OPEN_CONFIG",
    "A9": "OPEN_DEPLOYMENT",
    "A10": "OPEN_VERIFICATION",
    "A11": "RESIDUAL",
    "A12": "INTENTIONAL_CONTRACT_CHANGE"
  },
  "tests_added": {
    "file": "tests/audit-remediation.test.ts",
    "count": 15
  },
  "verdict": "NOT READY",
  "blocking_reasons": [
    "Bootstrap administrator secret remains in Git history until rotated and purged",
    "Mandatory administrator MFA is not enforced",
    "Monetary values use Float",
    "Account deletion hard-deletes store and financial history",
    "Admin-credentials migration is untracked and unapplied",
    "No restore drill or live custom-domain/browser validation"
  ],
  "not_performed": [
    "production or staging data access",
    "migrations, seeds, resets, restores",
    "payment/refund/email/DNS mutations",
    "live browser, DNS, TLS, SMTP, payment-gateway tests",
    "commit, push, history rewrite, release"
  ]
}
```
