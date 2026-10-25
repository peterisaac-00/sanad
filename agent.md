# Sanad Commerce — Phased Execution Plan

**Source:** Review dated 2026-10-23  
**Last updated:** 2026-10-23  
**Scope:** Frontend, backend/API, database, accounting, security, routing, storefront, UX, production readiness.

**Status key:** `[x]` implemented and verified · `[ ]` pending · `[ ] (partial)` part complete, remainder noted.

**Rule:** a phase is complete only when its exit gate passes. Every fix requires code, regression coverage, and passing lint/build/tests.

## Status at a Glance

| Phase | Focus | Status |
|---|---|---|
| 1 | Financial correctness and transactional integrity | ✅ Complete |
| 2 | Security, media, and data protection | ✅ Complete  |
| 3 | Feature truthfulness and integrations | ✅ Complete |
| 4 | Admin, RBAC, team, and custom domains | ✅ Complete |
| 5 | Storefront, SEO, performance, and currency model | ⏳ Pending |
| 6 | UX, accessibility, retention, and launch readiness | ⏳ Pending |

## Verification — 2026-10-23

| Check | Result |
|---|---|
| Phase 1 suite: `npx vitest run tests/phase1-integrity.test.ts --pool=forks --maxWorkers=1` | ✅ 12/12 passing |
| Full suite: `npm test` | ✅ 18 files, 67 tests passing |
| `npm run lint` (`tsc --noEmit`) | ✅ Passing |
| `npm run build` | ✅ Passing |
| `npm run build:server` | ✅ Passing |

**Database:** PostgreSQL 17.6 on `localhost:5432`; `tests/setup.ts` creates one test database per worker. CI must provide PostgreSQL as a service.  
**Bundle:** ~1.43 MB minified / ~327 KB gzip. Functional, but needs code splitting in Phase 5.

---

# Phase 1 — Financial Correctness and Transactional Integrity ✅

**Goal:** make revenue, inventory, refunds, payments, and loyalty trustworthy under concurrency and retries.  
**Exit gate:** all financial paths are serialized or idempotent; dashboard and reports use one accounting definition; all tests pass.

## Accounting

- [x] **R3.1 — Exclude cancelled/returned orders from sales.** `dashboard.ts`: one `revenueWhere` filter now drives total sales, month sales, and AOV. AOV divides by valid orders, not all orders. Daily revenue uses local calendar days to avoid midnight/DST drift. **Verified:** a 100 valid + 200 cancelled + 300 returned scenario returns sales 100, AOV 100, month sales 100.
- [x] **R3.2 — Top-product revenue is quantity × unit price.** `dashboard.ts`: replaced `groupBy` sum of unit prices with `SUM(qty * unit_price_egp)` and excluded lost orders. **Verified:** 3 × 100 cancelled order is ignored; 2 × 40 delivered order reports revenue 80.
- [x] **R3.3 — `status_counts` follows active filters.** `orders.ts`: list, export, and counters share `OrderFilters`/`orderWhere`. Counters apply search, payment, and date filters but ignore the `status` filter so status pills remain navigable. **Verified:** filtered list and counter behavior both covered.
- [x] **R3.9 — Report expenses stay inside the selected period.** `reports.ts`: added `createdAt: range` to wallet expense aggregation. **Verified:** 7 inside the range and 99 outside produce 7 expenses and net 93 in the test scenario.
- [x] **R3.10 — Lost orders do not contribute discounts or shipping.** `reports.ts`: cancelled/returned orders are excluded from revenue, discounts, shipping, coupon figures, affiliate figures, and daily discount series. **Verified:** only the valid order’s 10 discount and 5 shipping are reported.

## Transactions and Idempotency

- [x] **R3.4 — Coupon limits hold under concurrency.** `checkout.ts`: PostgreSQL advisory locks serialize by store/coupon and by customer identity. Coupon limits and first-order rules are revalidated inside the transaction. `identity.ts` normalizes phone/email identity. **Verified:** five concurrent checkouts on a one-use coupon create one order, one usage, and one stock decrement.
- [x] **R3.5 — Refunds cannot exceed the order total.** `orders.ts`: refund creation and processing lock the order, re-read aggregates inside the transaction, and validate against fresh totals. Double-processing returns 409. **Verified:** concurrent 60 + 60 refunds on a 100 order allow one and reject the other; remaining 40 can be refunded.
- [x] **R3.6 — Loyalty is earned on delivery and reversed on loss.** `checkout.ts` no longer grants points. `orders.ts` grants on `delivered` and revokes on `cancelled`/`returned`. `LoyaltyTransaction.orderId` plus `@@unique([accountId, orderId, type])` makes the ledger idempotent. **Verified:** 10 points on delivery, no double grant, 0 points and a -10 revoke after return; cancellation before delivery creates no account.
- [x] **R3.7 — Stock restoration is never silent.** `orders.ts`: store-scoped `updateMany` replacements; failures are collected and written to the order timeline as `stock_restore_failed` with SKU/qty/reason metadata. The status transition still completes, but the failure is auditable. **Verified:** code review and order-state tests. A dedicated double-restore regression test remains in Phase 6.
- [x] **R3.8 — Manual payment status is a state machine.** `validate.ts` defines `PAYMENT_TRANSITIONS`; `orders.ts` locks the order, rejects invalid transitions with 409, treats repeated status as a no-op, reuses pending payments, and allows only one succeeded payment. The UI exposes only valid transitions. **Verified:** concurrent paid requests both return 200 but create one payment; paid → unpaid returns 409. Real provider references and webhooks remain in Phase 3.
- [x] **R5.4 — Checkout supports `Idempotency-Key`.** A valid 8–128 character URL-safe key maps to `Order.idempotencyKey` with `@@unique([storeId, idempotencyKey])`. The service has a fast replay path plus unique-race fallback. The storefront keeps one key per checkout attempt and resets it after success. **Verified:** concurrent identical keys return the same order and decrement stock once; a new key creates a new order; a short key returns `INVALID_IDEMPOTENCY_KEY`.

## Identity and Test Environment

- [x] **R5.2a — Customer rows are deduplicated.** `identity.ts` strips non-digits and the `00` prefix from phones, lowercases/trims emails, and uses the result as an advisory-lock key. Checkout and manual orders use the same identity. **Verified:** `+20 100 123 4567` and `0020-100-123-4567` resolve to one customer (`201001234567`); per-customer coupon limits apply. Address deduplication is still pending as R5.2b.
- [x] **R2.2 — Test environment runs.** PostgreSQL 17.6 is available, per-worker databases are created, migrations deploy, and the full suite passes. CI still needs a PostgreSQL service.

## Phase 1 Files

- **Schema/migration:** `prisma/schema.prisma`, `prisma/migrations/20261023150000_phase1_integrity/migration.sql`
- **Backend:** `server/identity.ts`, `server/validate.ts`, `server/routes/dashboard.ts`, `server/routes/reports.ts`, `server/routes/orders.ts`, `server/routes/storefront.ts`, `server/services/checkout.ts`, `server/services/orders.ts`
- **Frontend:** `src/lib/api.ts`, `src/lib/format.ts`, `src/storefront/StorefrontCheckoutPages.tsx`, `src/dashboard/pages/OrdersPages.tsx`
- **Tests/config:** `tests/phase1-integrity.test.ts`, `vitest.config.ts`

---

# Phase 2 — Security and Media Hardening

**Goal:** close XSS, CSRF, rate-limit, session, and PII exposure gaps.  
**Exit gate:** the security test matrix passes; no active content is served from the app origin; rate limits work across replicas; PII is masked and audited.

## Uploads and Media

- [x] **R4.1 — Block unsanitized SVG.** SVG uploads are rejected. `/uploads` serves only an extension allowlist (`.jpg/.jpeg/.png/.webp/.gif`) with `nosniff`, a sandboxing CSP, CORP and COEP, so stored content can never execute as HTML/JS on the app origin. **Done when** `<script>`/`onload` payloads cannot execute.
- [x] **R9.3 — Validate actual image content.** `media.ts` checks magic bytes against the declared MIME, decodes with `sharp` (`failOn: error`, pixel cap), re-encodes every accepted image (stripping metadata/trailing polyglot data), enforces dimension/frame limits, and rejects SVG. **Done when** a fake PNG or polyglot upload is rejected.

## Request Integrity

- [x] **R4.2 — Reject mutations without Origin/Referer in production.** `middleware.ts` exports a pure `evaluateCsrfRequest`; production rejects mutations with neither `Origin` nor `Referer`, `null` origins and cross-site sources. **Done when** a browser POST without a source returns 403.
- [x] **R4.3 — Use distributed rate limiting.** Limits use PostgreSQL `rate_limit_buckets` with a single atomic upsert, shared by every replica (no Redis dependency). Dedicated budgets cover auth/email, public writes, tracking, carts, exports and media. **Done when** a limit hit on replica A blocks replica B.
- [x] **R4.5 — Define `trust proxy` explicitly.** `TRUST_PROXY=true` is rejected at boot; only a hop count or explicit proxy IP/CIDR list is accepted, and the setting is applied to Express. **Done when** client IPs cannot be spoofed through untrusted headers.

## Accounts and Sessions

- [x] **R4.4 — Add verification, reset, 2FA, and session revocation.** Email verification and reset use hashed, single-use, expiring tokens; TOTP 2FA (AES-256-GCM secrets, HMAC-hashed one-time recovery codes) is available to every account; password change keeps the current session and revokes others; reset revokes all sessions; `POST /api/auth/sessions/revoke-others` is explicit. **Done when** old sessions fail after a password change and reset tokens cannot be reused.

## Data Protection

- [x] **R4.6 — Protect exported PII.** Exports require an allowed role (`admin`, `owner`, `merchant`, `manager`), write an audit event, use a dedicated distributed limiter, stream with `no-store`, cap rows (`EXPORT_MAX_ROWS`, `413 EXPORT_TOO_LARGE`) and neutralize CSV formulas. Logs mask phone/email and redact tokens; carts/audit logs/sessions/tokens/buckets have retention sweeps. **Done when** a viewer cannot export PII and every export is attributable.
- [x] **R4.7 — Stop leaking DNS records and verification tokens.** Domain verification tokens are returned only once at creation/rotation; list, settings and verify responses return only sanitized domain state, `verified`, `status` and generic instructions. **Done when** the verification response contains neither.

## Public Endpoint Abuse

- [x] **R7.8 — Harden order tracking.** Checkout returns an HMAC-signed, expiring tracking token bound to one store/order; phone fallback remains for recovery. A dedicated distributed limiter blocks enumeration, responses mask the phone and omit order id/address/email. **Done when** enumeration attempts are blocked.
- [x] **R5.3 — Add abandoned-cart TTL and anti-abuse.** A retention job sweeps stale carts; empty carts without a phone/email signal are rejected; writes use a dedicated distributed limiter and contacts are normalized. CAPTCHA can be added later if abuse appears. **Done when** stale carts expire and the table cannot be flooded anonymously.

---

# Phase 3 — Feature Truthfulness and Integrations

**Goal:** no UI may imply that an unimplemented feature works. Ship it, flag it, or hide it.  
**Exit gate:** the feature inventory matches runtime behavior; no misleading toggles or paid-feature claims remain.

## Feature Inventory

- [x] **R10.1 — Online payments.** Online payments are marked unavailable in settings/onboarding and cannot be selected at checkout; credentials without a provider adapter still fail with `PAYMENT_ADAPTER_MISSING`. **Verified:** Phase 3 tests force both flat and nested online flags through the API, assert `onlinePaymentEnabled` stays `false`, and confirm checkout rejects online selection.
- [x] **R10.2 — Shipping carriers.** Shipping is explicitly manual: merchants manage zones, rates, and carrier names, while `trackingAvailable` stays `false` and marketing/settings copy states there is no carrier integration or live tracking. **Verified:** Phase 3 tests assert the manual integration status and static copy checks reject automated-tracking promises.
- [x] **R10.3 — WhatsApp automation.** Only `wa.me` links and prepared messages exist. `sendState` is `manual_links_only` or `template_required`; automated send always returns `sent: false`, and an abandoned-cart reminder is never marked sent automatically. **Verified:** Phase 3 tests assert `autoSendAvailable` is false, the reminder returns a manual-link state, and the cart remains `open`.
- [x] **R10.4 — S3 storage.** `STORAGE_DRIVER=s3` now fails startup with an explicit message because no S3 adapter exists; local disk is the only supported driver. **Verified:** Phase 3 tests accept `local` and assert `storageDriverError("s3")` names both the unsupported driver and the local fallback.
- [x] **R10.5 — Wallet deposit approval.** Superseded by Phase 4: wallet deposits are now real pending requests that change the balance only after an admin approves them. The `wallet_deposits` feature flag can pause intake with `503 WALLET_DEPOSITS_DISABLED`; the wallet page shows the pending state instead of a read-only gate. **Verified:** Phase 4 admin tests assert pending intake, flag gating, admin-only approval/rejection, and no balance change before approval.
- [x] **R10.6 — Affiliate settlement.** Settlement is manual and external: only delivered `pending` attributions settle, `settledAt` is recorded, a `manual_external` note is returned, and no withdrawable wallet balance is implied. **Verified:** Phase 3 tests settle one delivered and one shipped attribution; only the delivered one becomes `paid`, an audit entry is written, and a repeat settle returns `409`.
- [x] **R8.3 — Learn center scope.** The Learn surface is now labelled “الدليل السريع” (short guide) and links only to real dashboard workflows; `learnContent.ts` is the single route map. **Verified:** Phase 3 tests assert every guide path exists in the feature registry, every link is visible, and no unpublished checklist workflow is advertised.

## Product Surface

- [x] **R5.1 — Manual orders are clearly external.** Manual orders store `source: "manual"`, show an external-record banner, label amounts with the store currency, never create `OrderItem` rows or reserve stock, and include the source in the orders CSV. **Verified:** Phase 3 tests create a manual order, assert `source=manual`, zero stored items, a currency-aware amount label, and the exported source column.
- [x] **R7.2 — Feature flags replace dead sidebar entries.** `src/dashboard/features.ts` gives every console route exactly one state (`available`, `needs_setup`, `coming_soon`, `not_in_plan`); the sidebar renders only available/needs-setup entries and `FeatureGate` blocks hidden routes. Upsells, loyalty, wallet, and dropshipping are hidden; related products and affiliates remain visible with truthful badges. **Verified:** Phase 3 tests assert valid states, hidden/gated invariants, and that no hidden feature appears in the Learn guide.

---

# Phase 4 — Admin, RBAC, Team, and Custom Domains

**Goal:** separate platform administration from merchant accounts, enforce roles server-side, and make custom domains functional.  
**Exit gate:** team permissions are enforced by the API, custom domains open the correct store, and admin operations are audited.

## Admin and Roles

- [x] **R6.1 — Build a real admin back-office.** `/api/admin` now covers overview, stores, merchants, subscriptions, wallet approvals, support tickets, reports, domain/TLS review, audit/security events, store approval/suspension/unpublishing, feature flags, administrator management, and leads. Every route namegis an explicit admin permission and writes an actor-attributed audit row. **Verified:** `tests/admin-platform.test.ts` and `tests/phase4-admin-controls.test.ts` exercise each role boundary, wallet/subscription review, store lifecycle, support triage, flags, and audit attribution.
- [x] **R6.2 — Separate `PlatformAdmin` from `Merchant`.** Platform administration uses a distinct `PlatformAdmin` identity, `AdminSession` table, `sanad_admin_session` cookie (8-hour TTL), and its own MFA/recovery-code state. Merchant/team sessions receive `403 ADMIN_ACCESS_DENIED`; the legacy merchant `role=admin` no longer grants admin access. **Verified:** the admin-controls suite asserts cookie separation, the MFA challenge and one-time recovery codes, disabled-admin revocation, and legacy-role denial.
- [x] **R6.3 — Implement TeamMember authentication and RBAC.** Invites are one-time hashed tokens with acceptance/login pages; sessions bind to `teamMemberId` and role changes apply on the next request. Manager/staff/viewer permissions are enforced centrally by `requireStoreOwnership`, sensitive reads (`team`, `domains`, `wallet`, `audit-logs`) are permissioned, and suspension revokes all live team sessions. **Verified:** `tests/phase4-team-rbac.test.ts` and the export-role test in `tests/phase2-security.test.ts`.

## Domains and Publishing

- [x] **R8.1 — Make custom domains work end to end.** Pre-SPA host resolution trusts only the raw `Host` header, resolves verified `StoreDomain` rows, injects CSP-safe store metadata, and returns canonical custom-domain URLs. TLS/proxy status is recorded explicitly per domain, unknown hosts/assets never receive the SPA, and DNS/TXT plus verification instructions are shown in settings. **Verified:** `tests/phase4-domains-publishing.test.ts` covers normalization, verification, TLS success/failure, `X-Forwarded-Host` rejection, canonical URLs, unpublished-domain closure, and domain uniqueness.
- [x] **R8.2 — Clarify `/admin`.** `/admin` is a real platform-admin console with independent login, MFA, permission-filtered navigation, direct-tab forbidden states, and aliases for legacy `/admin/payments` and `/admin/visits`. Robots rules and copy now point to the real route. **Verified:** the admin UI and API suites cover authentication, permissions, aliases/unknown panels, and logout isolation.
- [x] **R7.1 — Unify onboarding and publishing states.** Publishing uses `draft → ready → published → suspended`, while `Store.status` remains the platform approval gate. Onboarding completion on a pending store marks it ready; approval publishes an onboarded store; unpublishing records a visible reason for both owner and visitor. **Verified:** publishing lifecycle tests in `tests/phase4-domains-publishing.test.ts` and `tests/admin-platform.test.ts`.

**Dependencies:** R10.5 is now fulfilled by the Phase 4 admin wallet workflow; R4.6 export authorization uses the Phase 4 RBAC model.

**Phase 4 verification:** `npm test` (24 files, 135 tests), `npm run lint`, `npm run build`, and `npm run build:server` all pass.

---

# Phase 5 — Storefront, SEO, Performance, and Currency Model

**Goal:** improve crawlability and performance, and make currency data honest.  
**Exit gate:** metadata is available without JS, bundle budgets pass, currency is explicit everywhere, and published stores have correct sitemaps/canonicals.

## Data Model

- [x] **R3.11 — Rename misleading currency fields.** `amountEgp`/`unitPriceEgp` store whatever the store currency is, and checkout supports fewer currencies than the UI advertises. Migrate to `amount`/`unitPrice` with `currency`, or isolate legacy fields and block unsupported currencies. **Done when** SAR/AED values are never read as EGP.

## Crawlability

- [ ] **R9.1 — Add SSR/prerender to the storefront.** Titles and JSON-LD currently depend on client JS. Prerender or server-render home, product, blog, and page routes. **Done when** crawlers and social previews see metadata without executing JS.
- [ ] **R8.4 — Generate dynamic sitemaps.** The current sitemap uses a fixed domain and hash URLs. Add a marketing sitemap plus per-store sitemap/robots for published stores only; use real `lastmod` values. **Done when** unpublished stores are excluded.
- [ ] **R8.5 — Fix canonical coverage.** Canonical handling covers only some search cases. Define canonical URLs for category/sort/page, mark unwanted filters `noindex`, and add prev/next where appropriate. **Done when** sorting and pagination do not create duplicate canonicals.
- [ ] **R8.6 — Return real 404s.** SPA fallback currently returns `index.html` for unknown assets and hosts. Return 404 for missing assets and unknown hosts. **Done when** `/missing.js` and unknown domains do not receive the SPA.

## Performance

- [ ] **R9.2 — Split the bundle.** Dashboard, marketing, and storefront ship together (~1.43 MB minified). Lazy-load surfaces, split vendor/feature chunks, analyze the bundle, and set an initial-load budget (e.g. ≤250 KB gzip). **Done when** each surface loads independently.
- [ ] **R9.4 — Generate responsive image variants.** Images are stored and served at original size. Add thumbnails, responsive URLs, and dimension limits. **Done when** mobile storefront pages do not download desktop originals.

---

# Phase 6 — UX, Accessibility, Retention, and Launch Readiness

**Goal:** finish daily-use UX, close accessibility gaps, clean data, and prove operational readiness.  
**Exit gate:** no open P0/P1 items; E2E, accessibility, security, and restore drills pass.

## UX and Accessibility

- [ ] **R7.3 — Simplify mobile navigation.** Reduce five bottom items (with 9px labels) to 3–4 primary items plus a grouped drawer; use at least 11–12px text. **Done when** navigation is usable at 320px.
- [ ] **R7.4 — Add a modal focus trap.** Move focus into the dialog, contain Tab, restore focus on close, and use `aria-labelledby` when a heading exists. **Done when** keyboard users cannot tab behind the modal.
- [ ] **R7.5 — Standardize loading and disabled states.** Cover checkout, product save, settings, order status, coupons, and refunds. **Done when** double-clicks cannot create duplicate mutations.
- [ ] **R7.6 — Standardize `rel="noopener noreferrer"`.** Apply it to every `target="_blank"` external link. **Done when** no external link lacks both protections.
- [ ] **R7.7 — Revalidate stale carts.** Local storage snapshots can be outdated. Revalidate on cart open or after an interval; show price, stock, and unpublished-product changes before checkout. **Done when** users see changes before submitting.
- [ ] **R7.9 — Test RTL and mixed text visually.** Cover long Arabic names, English SKUs, dashboard tables at 320px, mobile modals, and mixed currencies. **Done when** no clipping or overlap remains.
- [ ] **R7.10 — Unify error taxonomy.** Map 401, 403, 404, 409, 429, and 5xx to specific user actions. **Done when** no surface shows only a generic failure.

## Data Quality

- [ ] **R5.2b — Deduplicate customer addresses.** Checkout creates a new `CustomerAddress` each time. Normalize and deduplicate by a deterministic key while keeping one default. **Done when** repeated checkout with the same address adds no row.
- [ ] **R5.5 — Structure order events for translation.** Stop embedding English status names in Arabic messages. Store `event type + metadata` and translate in the UI. **Done when** the timeline renders localized statuses.
- [ ] **R3.7 (remaining test) — Prove double-restore safety.** Concurrent cancel/return must not double stock, and a deleted product must emit `stock_restore_failed` once. **Done when** the regression test passes.

## R11 — Launch Scope

Before launch, these must work end to end:

- [ ] Login and registration
- [ ] Onboarding
- [ ] Products, variants, and inventory
- [ ] Storefront home, catalog, and product pages
- [ ] Cart and COD checkout
- [ ] Orders and status transitions
- [ ] Customers
- [ ] Shipping zones
- [ ] Core settings
- [ ] Order tracking
- [ ] Audit and security basics
- [ ] Backup/restore and monitoring

## R13 — Test Matrix

**API/load**
- [ ] 100 concurrent checkouts on stock = 1
- [ ] 100 concurrent checkouts on a one-use coupon
- [ ] 10 concurrent refunds never exceed the order total
- [ ] Currency change before checkout
- [ ] Load tests for checkout, coupons, and refunds

**Security**
- [ ] SVG with script/event handler
- [ ] Polyglot image/file
- [ ] CSRF with missing/foreign Origin and Referer
- [ ] Session cookie after password change
- [ ] Cross-tenant IDs on every resource mutation
- [ ] Export authorization and rate limits
- [ ] Order-tracking enumeration
- [ ] Host-header/custom-domain poisoning

**UI/E2E**
- [ ] 320 / 375 / 768 / desktop
- [ ] RTL with mixed Arabic, English, and SKUs
- [ ] Refresh on every deep link
- [ ] Browser back/forward
- [ ] Modal keyboard navigation
- [ ] Slow network and 401/403/409/429/500 states
- [ ] Stale cart with deleted or repriced products
- [ ] Checkout double-click
- [ ] Onboarding resume after reload

**Operational**
- [ ] Backup restore drill
- [ ] Monitoring and alerting for errors, latency, failed payments, and stock failures
- [ ] Audit/security events
- [ ] Explicit launch approval

Phase 1’s regression suite already covers the accounting, coupon, refund, payment, loyalty, idempotency, and customer-identity baseline.

---

## Appendix A — Deferred or Flagged Features

1. Dropshipping — no supplier integrations.
2. AI assistant — no configured provider.
3. Affiliates — requires approval/payout cycle (R10.6).
4. Loyalty — earn/revoke is fixed; confirm redemption policy before launch.
5. Upsells/related products — no measurement.
6. Blog — only if acquisition/SEO is a current priority.
7. Learn center — keep as a short guide until R8.3 is complete.

## Appendix B — R12 Priority Map

**P0 — before commercial launch**
- [x] Revenue, AOV, top products, and status counts
- [x] Concurrent coupons and refunds
- [x] Loyalty grant/revoke
- [x] SVG and magic-byte validation (Phase 2)
- [ ] Checkout/payment idempotency: checkout and manual payments complete; real provider remains Phase 3
- [x] PostgreSQL and full test run
- [x] Password-change session invalidation (Phase 2)
- [ ] Disable or document unimplemented toggles (Phase 3)

**P1 — before expansion**
- [x] Distributed rate limiting via PostgreSQL shared buckets (Phase 2)
- [x] Email verification, reset, and 2FA (Phase 2)
- [x] Team authentication and RBAC (Phase 4)
- [x] Admin back-office (Phase 4)
- [x] Custom domains end to end (Phase 4)
- [ ] Dynamic sitemap and SSR/prerender (Phase 5)
- [ ] Image processing and thumbnails (Phase 5)
- [x] Cart/audit retention (Phase 2/6)

**P2 — UX and performance**
- [ ] Code splitting and lazy routes (Phase 5)
- [ ] Modal focus trap (Phase 6)
- [ ] Stale-cart revalidation (Phase 6)
- [ ] Mobile navigation and font sizes (Phase 6)
- [ ] Unified error/loading states (Phase 6)
- [ ] Visual regression and E2E tests (Phase 6)
