# Sanad — Client Handover Guide

## 1. How to deploy

Prerequisites: a host with Docker, and a managed PostgreSQL 16+ (or the
bundled `db` service for small installs).

```powershell
# 1) Configure secrets (never commit .env)
$env:SESSION_SECRET = "<64 hex chars>"
$env:CORS_ORIGIN = "https://shop.example.com"

# 2) Start everything (Postgres + migrations + app)
docker compose up --build -d

# 3) Verify
curl https://shop.example.com/api/health
# {"ok":true,"service":"sanad-commerce-backend","db":"up",...}
```

Manual (non-Docker) deploy:

```powershell
npm ci
npx prisma migrate deploy          # needs DATABASE_URL
npm run build; npm run build:server
NODE_ENV=production SESSION_SECRET=<...> DATABASE_URL=<...> npm start
```

Put a TLS-terminating reverse proxy (Caddy/nginx/Cloud Run) in front and set
`TRUST_PROXY` to the number of trusted hops (usually `1`) or an explicit proxy
IP/CIDR list so rate limiting sees real client IPs. `TRUST_PROXY=true` is
rejected because it would let any client spoof `X-Forwarded-For`.

## 2. Environment / secrets

All variables are documented in `.env.example`. The critical ones:

| Secret | How to create | Notes |
|--------|---------------|-------|
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | 32+ chars, required in production |
| `DATABASE_URL` | from your Postgres provider | `postgresql://user:pass@host:5432/sanad` |

Store them in your hosting provider's secret manager (never in git, chat, or
screenshots).

### First platform administrator

Platform staff are a separate identity from merchants. Do **not** promote a
merchant account: `Merchant.role` never grants platform administration, and a
merchant or team session always receives `403 ADMIN_ACCESS_DENIED` at
`/api/admin`.

Set the bootstrap values before the first boot (both email and password are
required together; the password must be at least 12 characters):

```powershell
$env:ADMIN_BOOTSTRAP_EMAIL = "owner@example.com"
$env:ADMIN_BOOTSTRAP_PASSWORD = "<long-random-password>"
$env:ADMIN_BOOTSTRAP_NAME = "Owner"   # optional
docker compose up --build -d
```

At boot the server creates a `super_admin` only when no administrator with that
email exists. The operation is idempotent: restarting never resets an existing
password, name, role, or MFA state. Remove `ADMIN_BOOTSTRAP_PASSWORD` (and the
email/name) from the environment after the first successful sign-in and restart;
the account persists in PostgreSQL.

Open `/admin`, sign in with the bootstrap credentials, and enable TOTP under
**Security** immediately. Admin sessions use a separate `sanad_admin_session`
cookie (`__Host-sanad_admin_session` in production) with an 8-hour TTL; a
merchant cookie cannot open the admin console and an admin cookie cannot open
the merchant dashboard.

Administrator roles and write access:

| Role | Writes |
|------|--------|
| `super_admin` | everything, including administrator management |
| `operations` | stores, custom domains/TLS, feature flags |
| `finance` | wallet deposits/transactions, subscription payments |
| `support` | support tickets |
| `readonly` | no writes; read-only back-office |

Add further administrators from `/admin` → **Admins**; they can enable their own
MFA after signing in. Legacy `/admin/payments` and `/admin/visits` links redirect
to subscriptions and reports. Admins can list every lead via
`GET /api/admin/leads`; merchants always see only their own store's leads via
`GET /api/leads`.

## 3. Create the first merchant account

Option A — self-serve UI: open the site, **Create account**, then finish the
five-step onboarding wizard. Completing onboarding submits the store for review;
it does not open it. A platform admin must approve the store from `/admin/stores`
before customers can reach `/store/:subdomain`. While the store is pending,
rejected, or suspended, the public URL is closed.

Option B — API:

```powershell
Invoke-RestMethod -Method POST https://shop.example.com/api/auth/register `
  -ContentType "application/json" -Body (@{
    email="owner@example.com"; password="Choose-A-Strong-Password-123";
    storeName="My Store"; subdomain="mystore"; countryCode="EG";
    storeCurrency="EGP"
  } | ConvertTo-Json)
```

Subdomains are unique; the store address becomes `mystore.sanad.app`
(or your domain). Registration returns a session cookie; publish with:

```powershell
# Save the cookie from register, then configure + publish through the real API:
Invoke-RestMethod -Method PATCH https://shop.example.com/api/onboarding `
  -WebSession $session -ContentType "application/json" -Body (@{
    businessType="fashion"; templateKey="fashion"; description="متجري";
    whatsapp="201000000000"; codEnabled=$true
  } | ConvertTo-Json)
Invoke-RestMethod -Method POST https://shop.example.com/api/onboarding/complete -WebSession $session
```

An admin must then approve the store from `/admin/stores`; approval records
`activatedAt` and is what makes the published storefront publicly accessible.

The dashboard is at `/dashboard`; the public storefront is at
`/store/<subdomain>`.

## 4. Back up and restore Postgres

```powershell
# backup
docker compose exec db pg_dump -U sanad sanad | Compress-Archive ... # or:
docker compose exec db pg_dump -U sanad -F c sanad > sanad-$(Get-Date -Format yyyyMMdd).dump
# restore
docker compose exec -T db pg_restore -U sanad -d sanad -c < sanad-YYYYMMDD.dump
```

Keep daily dumps off-site. Test restores quarterly.

Product/logo/cover uploads are stored on disk under `STORAGE_DIR`
(default `data/uploads`) and served at `/uploads`. Back up that directory
together with the database; a DB restore without it leaves broken image URLs
(no data is lost, but media must be re-uploaded). S3 is not supported yet:
selecting `STORAGE_DRIVER=s3` stops the app at startup. When a real adapter
ships, back up that bucket instead.

## 5. Rotate SESSION_SECRET

1. Generate a new secret.
2. Deploy with the new value and restart the app.
3. Effect: **every session is invalidated** — all merchants must log in again.
   No data loss. Announce a maintenance window.

## 6. Turn DEMO_MODE off

Production must run with `DEMO_MODE` unset or `false` (the default). Verify:

```powershell
Invoke-RestMethod https://shop.example.com/api/stores/saraya
# expect 404 — no demo store exists
```

If you ever enabled it, delete demo rows (`stores.subdomain='saraya'` and its
merchant) and rotate `SESSION_SECRET`.

## 7. Media and integrations

| Feature | Current behavior | To enable more |
|---------|------------------|----------------|
| Media upload | Images are validated (JPEG/PNG/WebP/GIF/SVG) and stored under `STORAGE_DIR`; `/uploads` serves them | S3 is not implemented: `STORAGE_DRIVER=s3` exits at startup. Use `local` until an adapter ships |
| Online payments | COD is complete; online checkout is rejected with a clear error | Add a provider-specific adapter, then set `PAYMENT_PROVIDER` + `PAYMENT_SECRET_KEY` |
| AI assistant | Disabled unless an OpenAI-compatible endpoint is configured | Set `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` |
| WhatsApp | `wa.me` links are real; abandoned-cart reminders open a link | Auto-send needs Cloud API credentials **and** an approved template |
| Shipping | Zones, rates, COD fees, free-shipping thresholds and customer order-tracking links are real | Carrier API/tracking adapter is manual/future work |
| Abandoned carts | Captured from real storefront carts; merchant can mark/remind | Automatic messages require WhatsApp/SMS integration |

No integration fakes success. When something is not configured, the UI/API
shows a configuration error instead of pretending the operation happened.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| App exits: `DATABASE_URL is required` | missing env | set `DATABASE_URL` |
| App exits: `SESSION_SECRET must be set` | weak/missing secret in prod | set 32+ char secret |
| App exits: `ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set together` | only one bootstrap value is present | set both, or remove both after the first admin exists |
| App exits: `ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters` | bootstrap password too short | use 12+ characters, then remove the variable after first sign-in |
| `/admin` says the password is wrong after a restart | bootstrap never resets existing admins | sign in with the current password; reset it from **Security** while signed in |
| Merchant/team account gets `403 ADMIN_ACCESS_DENIED` at `/admin` | expected trust boundary | use a `PlatformAdmin` account or bootstrap the first one |
| `401 UNAUTHENTICATED` in console | cookie blocked | serve frontend+API same-origin; check `CORS_ORIGIN` |
| `403 CSRF_BLOCKED` on mutations | cross-site POST | call API from an allowed origin only |
| `429` on login | rate limit (30/15 min) | wait, or check for brute force in logs |
| `Request failed (502)` on register/API | API is not running, so the frontend's `/api` proxy has no upstream | run `npm run dev` (starts API + frontend, API first); check `/api/health` |
| `/api/health` → `503 db down` | Postgres unreachable | check `DATABASE_URL`, SG/firewall, `docker compose ps` |
| `409 INVALID_TRANSITION` | illegal order jump | follow the transition map: `pending → needs_confirmation/confirmed/cancelled`, `confirmed → preparing/ready_to_ship/shipped/cancelled`, `shipped/out_for_delivery → delivered/returned` |
| `400 VARIANT_REQUIRED` at checkout | product has active variants but the request sent only a product SKU | send the selected `variantId` (the storefront does this automatically) |
| Storefront shows “قيد التجهيز” | store has not completed onboarding | finish the wizard and press publish (`POST /api/onboarding/complete`) |
| `503 PAYMENT_PROVIDER_NOT_CONFIGURED` / `PAYMENT_ADAPTER_MISSING` | online payment is disabled or has no adapter | use COD or install a payment adapter; this is intentional, not a bug |
| `503 AI_NOT_CONFIGURED` | no AI provider configured | set `AI_BASE_URL` + `AI_API_KEY` |
| `413 MEDIA_TOO_LARGE` / app exits on `STORAGE_DRIVER=s3` | upload exceeds `MEDIA_MAX_BYTES`, or S3 was selected without an adapter | raise the limit / use `STORAGE_DRIVER=local` |
| Register says email is taken | intentional: duplicate emails get 409 so merchants get a clear error; enumeration is blunted by the auth rate limit (30/15 min) | accepted tradeoff, do not "fix" by hiding it |

Logs are structured (pino JSON). Passwords/tokens/cookies are redacted.

## 9. Out of scope / future work

- Subscription billing is manual: owners submit payment details and finance
  admins review them from `/admin/payments`. Approval updates `Store.plan` and
  `Store.subscriptionPaidUntil`; automatic charging/renewal is out of scope.
- Email verification, password reset, merchant/admin 2FA and team invites are
  implemented. Social login and admin email invitations are not.
- Multiple stores per merchant (schema-ready; API/UI assume one).
- Online payment provider adapter (Paymob/Fawry/Mada) — COD is complete.
- S3/object-storage adapter; local disk is the supported driver today.
- Automatic WhatsApp/Cloud API sends (approved templates) and carrier APIs.
- Automated DB/upload backups (operator cron, see §4).
- Horizontal scaling notes: sessions live in Postgres (shared-nothing safe);
  use sticky-less replicas + a managed DB; rate limits are per-instance memory.
