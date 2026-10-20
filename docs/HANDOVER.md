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
`TRUST_PROXY=true` so rate limiting sees real client IPs.

## 2. Environment / secrets

All variables are documented in `.env.example`. The critical ones:

| Secret | How to create | Notes |
|--------|---------------|-------|
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | 32+ chars, required in production |
| `DATABASE_URL` | from your Postgres provider | `postgresql://user:pass@host:5432/sanad` |

Store them in your hosting provider's secret manager (never in git, chat, or
screenshots).

Promote a merchant to admin with SQL (no shared secret exists by design):

```sql
UPDATE merchants SET role='admin' WHERE email='owner@example.com';
```

Admins can list every lead via `GET /api/admin/leads`. Merchants always see
only their own store's leads via `GET /api/leads`.

## 3. Create the first merchant account

Option A — self-serve UI: open the site, **Create account**, then finish the
five-step onboarding wizard. The store is only public after the merchant
presses publish; before that `/store/:subdomain` shows a branded
“قيد التجهيز” page.

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
(no data is lost, but media must be re-uploaded). If you switch to S3 later,
back up the bucket instead.

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
| Media upload | Images are validated (JPEG/PNG/WebP/GIF/SVG) and stored under `STORAGE_DIR`; `/uploads` serves them | Set `STORAGE_DRIVER=s3` only after installing an S3 adapter; today it returns `STORAGE_INTEGRATION_NOT_CONFIGURED` |
| Online payments | COD is complete; online checkout is rejected with a clear error | Add a provider-specific adapter, then set `PAYMENT_PROVIDER` + `PAYMENT_SECRET_KEY` |
| AI assistant | Disabled unless an OpenAI-compatible endpoint is configured | Set `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` |
| WhatsApp | `wa.me` links are real; abandoned-cart reminders open a link | Auto-send needs Cloud API credentials **and** an approved template |
| Shipping | Zones, rates, COD fees, free-shipping thresholds and tracking links are real | Carrier API adapter is manual/future work |
| Abandoned carts | Captured from real storefront carts; merchant can mark/remind | Automatic messages require WhatsApp/SMS integration |

No integration fakes success. When something is not configured, the UI/API
shows a configuration error instead of pretending the operation happened.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| App exits: `DATABASE_URL is required` | missing env | set `DATABASE_URL` |
| App exits: `SESSION_SECRET must be set` | weak/missing secret in prod | set 32+ char secret |
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
| `413 MEDIA_TOO_LARGE` / `503 STORAGE_INTEGRATION_NOT_CONFIGURED` | upload exceeds `MEDIA_MAX_BYTES` or S3 selected without an adapter | raise the limit / use `STORAGE_DRIVER=local` |
| Register says email is taken | intentional: duplicate emails get 409 so merchants get a clear error; enumeration is blunted by the auth rate limit (30/15 min) | accepted tradeoff, do not "fix" by hiding it |

Logs are structured (pino JSON). Passwords/tokens/cookies are redacted.

## 9. Out of scope / future work

- Subscription billing is out of scope: every store is created with the
  server-assigned default plan (`annual`), `plan` is not client-writable via
  register or `PATCH /api/account/store`, and there are no payment, upgrade,
  downgrade, or invoicing flows. Handle billing entirely outside the app
  (e.g. manual invoicing or a billing provider) and change plans with direct
  database updates until a billing module is built.
- Email verification, password reset, 2FA, social login.
- Multiple stores per merchant (schema-ready; API/UI assume one).
- Online payment provider adapter (Paymob/Fawry/Mada) — COD is complete.
- S3/object-storage adapter; local disk is the supported driver today.
- Automatic WhatsApp/Cloud API sends (approved templates) and carrier APIs.
- Admin/back-office UI (leads are API-only; use `GET /api/admin/leads` with an admin merchant + scripts).
- Automated DB/upload backups (operator cron, see §4).
- Horizontal scaling notes: sessions live in Postgres (shared-nothing safe);
  use sticky-less replicas + a managed DB; rate limits are per-instance memory.
