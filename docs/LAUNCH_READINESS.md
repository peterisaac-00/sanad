# Phase 6 — Launch Readiness

**Updated:** 2026-10-26
**Scope:** the remaining Phase 6 work (R7.5, R7.9, R7.10), the R3.7
double-restore proof, and the R11/R13 launch checks.

## 1. What was completed in this pass

| Item | Change | Evidence |
|---|---|---|
| R7.5 loading/disabled | Added in-flight refs and `loading`/`disabled` to checkout, product save, coupon save/toggle, settings save, team role/status, domain verify/rotate/remove, order status/payment, add-note, refunds and CSV export. | `tests/phase6-ux.test.ts` |
| R7.9 RTL / mixed text | Dashboard table cells wrap long Arabic/English values; wide tables scroll; account text truncates; invite URLs break; nav labels are 12px; root is `lang="ar" dir="rtl"`. | `tests/phase6-ux.test.ts` |
| R7.10 error taxonomy | `presentApiError` maps 401/403/404/409/429/5xx/network to actions; `safeError` is used by every interactive surface; `ErrorState` and `ErrorBlock` render the action; API 401 clears stale session state. | `tests/phase6-ux.test.ts` |
| R3.7 double restore | Regression cases exist for cancel/return races and the deleted-product failure event. Execution needs PostgreSQL. | `tests/order-status.test.ts` |
| R11 / R13 | Each automated item is mapped to a suite in `agent.md`; this document lists the remaining host/browser drills. | — |

## 2. Verified in this environment

```powershell
npm run lint          # tsc --noEmit — passing
npm run build         # vite build — passing
npm run build:server  # esbuild server bundle — passing
npx vitest run tests/phase6-ux.test.ts --config <no-db-config>  # 21/21 passing
```

`tests/phase6-ux.test.ts` is a pure source/unit contract and does not need a
database. The full suite is the authoritative gate.

> This workspace has **no running PostgreSQL and no Docker daemon**, so database
> suites and the restore drill could not be executed here. Run them on the
> launch host (or CI) before sign-off.

## 3. Full verification commands

```powershell
# 1) Database-backed suite (starts a per-worker test database)
npm test

# 2) The double-restore proof on its own
npx vitest run tests/order-status.test.ts --pool=forks --maxWorkers=1

# 3) Load smoke
$env:LOAD_BASE_URL = "https://staging.example.com"
$env:LOAD_ENDPOINT = "/api/live"
$env:LOAD_CONCURRENCY = "100"
$env:LOAD_REQUESTS = "2000"
npm run load:smoke

# 4) Backup + restore drill (staging only)
npm run db:backup
$env:CONFIRM_RESTORE = "yes"
npm run db:restore -- backups/<stamp>
```

For the 100-way checkout/coupon and 10-way refund runs, use the same patterns as
`tests/checkout-race.test.ts`, `tests/phase1-integrity.test.ts` and
`tests/order-status.test.ts` against the load host, then record the result here.

## 4. Manual browser matrix (R13 UI/E2E)

Run against staging in Chrome and Safari/iOS. Tick every row.

| Check | 320 | 375 | 768 | Desktop |
|---|---|---|---|---|
| Marketing home and pricing | [ ] | [ ] | [ ] | [ ] |
| Register → onboarding → resume after reload | [ ] | [ ] | [ ] | [ ] |
| Dashboard nav drawer opens/closes, labels ≥ 12px | [ ] | [ ] | [ ] | [ ] |
| Orders table scrolls, long Arabic names wrap | [ ] | [ ] | [ ] | [ ] |
| Products editor modal at 320px, keyboard Tab trap | [ ] | [ ] | [ ] | [ ] |
| Settings with long email/link, mixed LTR values | [ ] | [ ] | [ ] | [ ] |
| Storefront product/cart/checkout at 320px | [ ] | [ ] | [ ] | [ ] |
| Stale cart shows repriced/deleted/unpublished changes | [ ] | [ ] | [ ] | [ ] |
| Double-click checkout creates one order | [ ] | [ ] | [ ] | [ ] |
| Deep-link refresh and browser back/forward | [ ] | [ ] | [ ] | [ ] |
| Modal Escape closes and focus returns to trigger | [ ] | [ ] | [ ] | [ ] |

Error/loading states to force (throttle in DevTools):

- 401 — sign out in a second tab, click "save"; expect sign-in action.
- 403 — open a dashboard URL as a `viewer` team member; expect access message.
- 404 — open a deleted product/order; expect "not found" and a back action.
- 409 — change an order status in two tabs; expect refresh/review.
- 429 — hammer login/tracking; expect wait-and-retry.
- 5xx — stop the API; expect retry, no white screen or stuck spinner.

## 5. Operational sign-off

| Item | Owner | Date | Result |
|---|---|---|---|
| `npm test` on PostgreSQL | | | |
| `tests/order-status.test.ts` double restore | | | |
| Load: 100 checkout / 100 coupon / 10 refunds | | | |
| `npm run db:backup` + restore drill | | | |
| Alerting connected (`/api/ready`, 5xx rate, failed payments, `stock_restore_failed`) | | | |
| Browser matrix complete | | | |
| Explicit launch approval | | | |

**Launch gate:** no open P0/P1 item, every row above signed, and
`docs/HANDOVER.md` secrets/deployment steps confirmed for the target host.
