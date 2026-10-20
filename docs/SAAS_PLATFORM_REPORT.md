# Sanad SaaS Platform — Implementation Report

This report covers the expansion of Sanad from a single-store merchant console
into a multi-tenant Arabic SaaS commerce platform. All work is uncommitted on
the current branch; no production data or fake payment paths were introduced.

## 1. Scope delivered

- Marketing site preserved, with real CTAs: **Sign in**, **Create account**,
  **Start your store**; authenticated users go to `/dashboard`.
- Real client routes: `/auth/login`, `/auth/register`, `/onboarding`,
  `/dashboard` + 22 dashboard routes, and `/store/:subdomain/*`.
- Five-step RTL onboarding with progress, autosave, validation, continue-later,
  real media upload, templates, selling/shipping setup, previews and publish.
- Dark-first RTL dashboard with a right sidebar, blue primary, mobile drawer and
  bottom navigation; all data comes from real APIs (no hardcoded KPIs).
- Real CRUD for categories, products, orders, customers, wallet, abandoned
  carts, upsells, related products, coupons, shipping, pages, design, blog,
  affiliates, loyalty, dropshipping, reviews, assistant, reports, settings,
  audit logs, domains, team and learn.
- Public storefront with branding/themes, hero, categories, catalog, variants,
  cart, coupons, shipping quotes, COD, order success/tracking, WhatsApp, SEO,
  JSON-LD, CMS pages, blog and empty/error/loading states.
- Storefront is gated by publication: unpublished stores show a branded
  “قيد التجهيز” page.
- Server-side price/stock/coupon/shipping validation, database transactions,
  audit logs and strict Zod schemas.
- Tests for auth, authorization, tenant isolation, products, orders, checkout,
  storefront publication, catalog/variants/reviews, coupons/shipping and public
  order lookup.

## 2. Phase summaries

### Phase 1 — Data model and backend platform

- Expanded `prisma/schema.prisma` to 43 models covering the full commerce
  surface, all store-scoped where applicable.
- Added migration `prisma/migrations/20261020190000_saas_platform/`.
- Added `server/services/` modules:
  - `checkout.ts` — server-side line resolution, duplicate merging, stock,
    coupons, shipping quotes, COD, order/payment rows, loyalty, abandoned cart,
    affiliate attribution and order events inside one transaction.
  - `integrations.ts` — honest AI/payment/WhatsApp/shipping boundaries.
  - `media.ts` — validated local-disk image storage with a future S3 boundary.
  - `account.ts` — slugging, defaults, audit/notification helpers.
  - `orders.ts` — order numbers and transition enforcement.
- Added routers: onboarding, categories, customers, wallet, shipping, coupons,
  growth, content, reviews, loyalty, dropshipping, assistant, dashboard,
  abandoned carts, reports, settings, media and storefront.
- Rewired `server/index.ts`; added `/uploads` static serving and base64 media
  body parser.
- Security: every dashboard route uses `requireAuth` +
  `requireStoreOwnership`; public routes are allowlisted and rate-limited.

### Phase 2 — Client shell, auth and onboarding

- Added `src/lib/router.tsx` (History API router with query support),
  `src/lib/api.ts`, `src/lib/session.tsx`, `src/lib/format.ts` and `useAsync`.
- Added shared UI kit (`src/components/ui.tsx`), uploader, branding helpers and
  store preview components.
- Added `src/auth/LoginPage.tsx`, `RegisterPage.tsx`, `AuthShell.tsx`:
  httpOnly cookie auth, show/hide password, loading/errors, safe redirects.
- Added `src/onboarding/OnboardingPage.tsx`: five RTL steps, local autosave,
  validation, continue later, media upload, template selection, selling setup,
  previews and publish.
- Root `src/App.tsx` dispatches between marketing, auth, onboarding, dashboard
  and storefront under `ToastProvider > SessionProvider`.
- Marketing extracted to `src/marketing/MarketingApp.tsx`; `Navbar` CTAs now
  navigate to real routes and use the real session.

### Phase 3 — Dashboard

- Added `src/dashboard/DashboardShell.tsx`, `DashboardRouter.tsx`,
  `DashboardHome.tsx` and shared dashboard components.
- Implemented 22 routes in five groups (overview, store, growth, content,
  operations), including mobile drawer/bottom navigation and 404 handling.
- All pages use live API data and real mutations; no placeholder KPI values.

### Phase 4 — Public storefront

- Added `src/storefront/`:
  - `StorefrontContext.tsx` — store data, theme, cart/coupon localStorage.
  - `StorefrontApp.tsx` — public routing, header/footer, publication gate.
  - `StorefrontHomePage.tsx`, `StorefrontProductsPages.tsx`,
    `StorefrontCheckoutPages.tsx`, `StorefrontContentPages.tsx`,
    `StorefrontUI.tsx`.
- Storefront features: merchant branding/colors/fonts, dark/light/system mode,
  categories, featured products, search/filter/sort/pagination, variants,
  reviews, related products, cart, coupon validation, shipping quote, COD,
  order confirmation/tracking, CMS pages, blog, WhatsApp links, SEO meta and
  JSON-LD.
- Public API contracts in `server/routes/storefront.ts`; checkout remains
  `POST /api/stores/:subdomain/checkout` for compatibility.

### Phase 5 — Tests, fixes and documentation

- Added `tests/storefront-platform.test.ts` (6 tests) and
  `tests/tenant-isolation.test.ts` (2 tests).
- Added `publishStore()` test helper that completes onboarding through the real
  API.
- Fixed a real routing bug discovered by the new tests: the onboarding router
  was mounted at the application root, so the frontend calls to
  `/api/onboarding` returned 404. It is now mounted at `/api/onboarding`.
- Sanitized public product responses: merchant-only fields (`costPrice`,
  `barcode`, `lowStockThreshold`, internal status, etc.) are no longer exposed.
- Added `VARIANT_REQUIRED` checkout validation: products with active variants
  must be purchased by `variantId`, preventing SKU-based stock bypass.
- Public order tracking now returns line images, variant labels and SKUs, plus
  the customer phone after phone verification.
- Updated `README.md`, `docs/HANDOVER.md` and `.env.example`.
- Added this report.

## 3. Database changes

New migration: `prisma/migrations/20261020190000_saas_platform/`.

New/extended tables (all operational tables carry `storeId`):

`StoreBranding`, `StoreTheme`, `StoreDomain`, `TeamMember`, `Category`,
`ProductImage`, `ProductOption`, `ProductOptionValue`, `ProductVariant`,
`Customer`, `CustomerAddress`, `OrderEvent`, `ShippingZone`, `ShippingRate`,
`Coupon`, `CouponUsage`, `UpsellRule`, `RelatedProduct`, `Page`, `BlogPost`,
`Affiliate`, `AffiliateAttribution`, `WalletAccount`, `WalletTransaction`,
`AbandonedCart`, `Payment`, `Refund`, `Review`, `Notification`, `AuditLog`,
`MediaAsset`, `LoyaltyRule`, `LoyaltyAccount`, `LoyaltyTransaction`,
`Supplier`, `DropshipProduct`.

Existing `Store`, `Merchant`, `Product`, `Order`, `OrderItem`, `Lead` and
`Session` gained onboarding, branding, status, payment, shipping and contact
fields. Legacy order statuses are preserved; new statuses are additive.

## 4. API changes (high level)

- Onboarding: `GET/PATCH /api/onboarding`, `POST /api/onboarding/complete`
  (now correctly mounted).
- Dashboard domains: `/api/stores/:subdomain/{products,categories,orders,
  customers,wallet,shipping-zones,coupons,upsells,related-products,pages,blog,
  affiliates,reviews,loyalty,dropshipping,suppliers,dropship-products,
  assistant,summary,reports,settings,design,domains,team,audit-logs,
  abandoned-carts,notifications}`.
- Storefront: `/api/storefront/:subdomain/{,products,products/:slug,categories,
  pages/:slug,blog,blog/:slug,reviews,reviews/:productId,coupon,shipping-quote,
  cart,orders/:orderNumber}`.
- Public checkout: `POST /api/stores/:subdomain/checkout`.
- Media: `POST/GET /api/media`.
- All bodies/params/queries are strict Zod schemas; unknown fields return 400.
- Error shape: `{ "error": { "code": "...", "message": "...", "details"?: ... } }`.
- Order status and payment status remain independent; invalid transitions
  return `409 INVALID_TRANSITION`.

## 5. Verification

Executed in this repository:

```text
npm run lint   # tsc --noEmit, exit 0
npm run build  # vite build, 1726 modules, built successfully
npm test       # Test Files 15 passed (15), Tests 50 passed (50)
```

The test suite runs against real per-worker PostgreSQL databases and covers:

- auth/session hardening, CSRF origin checks, rate limiting;
- authorization matrix (anonymous 401 / other merchant 403 / owner 200);
- tenant isolation for legacy and new dashboard endpoints;
- product CRUD, validation, search and pagination;
- order filters, transitions, numbering and summary;
- checkout pricing, stock movement, duplicate-line merging and race handling;
- storefront publication gate and safe public payload;
- catalog filters, variants, reviews moderation and related products;
- coupons, shipping quotes, free thresholds, COD and online-payment rejection;
- phone-scoped public order lookup and cross-store isolation.

## 6. Remaining work / limitations

1. **Online payment adapter:** no provider-specific implementation exists.
   `PAYMENT_PROVIDER` + `PAYMENT_SECRET_KEY` alone still return
   `PAYMENT_ADAPTER_MISSING`. COD is the only complete method.
2. **S3 storage:** `STORAGE_DRIVER=s3` is an honest boundary that returns
   `STORAGE_INTEGRATION_NOT_CONFIGURED`; local disk is implemented.
3. **WhatsApp auto-send:** `wa.me` links work; Cloud API sending requires
   approved templates and is not implemented.
4. **Carrier APIs:** shipping zones/rates/COD fees/tracking links are real;
   automatic carrier booking/tracking is manual.
5. **AI assistant:** works only with a real OpenAI-compatible endpoint.
6. **Account features:** no email verification, password reset, 2FA, social
   login or subscription billing.
7. **Multi-store:** schema supports multiple stores; API/UI assume one store per
   merchant.
8. **Scaling:** rate limits are per-instance memory; use Redis for multiple
   replicas. Sessions are already in PostgreSQL.
9. **Manual smoke test:** run `npm run dev`, register a merchant, finish
   onboarding, publish, and verify `/store/:subdomain` plus dashboard CRUD in a
   browser. Automated API tests pass, but a visual browser pass is still
   recommended before deployment.
10. **Bundle size:** the Vite build warns about a 1.4 MB JS chunk; code splitting
    is a future optimization.
