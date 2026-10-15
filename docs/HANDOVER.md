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

Option A — self-serve UI: open the site, **Create store**, fill store +
account details. The account is merchant-ready immediately.

Option B — API:

```powershell
Invoke-RestMethod -Method POST https://shop.example.com/api/auth/register `
  -ContentType "application/json" -Body (@{
    email="owner@example.com"; password="Choose-A-Strong-Password-123";
    storeName="My Store"; subdomain="mystore"; countryCode="EG";
    storeCurrency="EGP"; selectedPlan="annual"
  } | ConvertTo-Json)
```

Subdomains are unique; the store address becomes `mystore.sanad.app`
(or your domain).

## 4. Back up and restore Postgres

```powershell
# backup
docker compose exec db pg_dump -U sanad sanad | Compress-Archive ... # or:
docker compose exec db pg_dump -U sanad -F c sanad > sanad-$(Get-Date -Format yyyyMMdd).dump
# restore
docker compose exec -T db pg_restore -U sanad -d sanad -c < sanad-YYYYMMDD.dump
```

Keep daily dumps off-site. Test restores quarterly.

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

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| App exits: `DATABASE_URL is required` | missing env | set `DATABASE_URL` |
| App exits: `SESSION_SECRET must be set` | weak/missing secret in prod | set 32+ char secret |
| `401 UNAUTHENTICATED` in console | cookie blocked | serve frontend+API same-origin; check `CORS_ORIGIN` |
| `403 CSRF_BLOCKED` on mutations | cross-site POST | call API from an allowed origin only |
| `429` on login | rate limit (30/15 min) | wait, or check for brute force in logs |
| `/api/health` → `503 db down` | Postgres unreachable | check `DATABASE_URL`, SG/firewall, `docker compose ps` |
| `422 INVALID_TRANSITION` | illegal order jump | follow pending→confirmed→shipped→delivered |

Logs are structured (pino JSON). Passwords/tokens/cookies are redacted.

## 8. Out of scope / future work

- Subscription billing is out of scope: every store is created with the
  server-assigned default plan (`annual`), `plan` is not client-writable via
  register or `PATCH /api/account/store`, and there are no payment, upgrade,
  downgrade, or invoicing flows. Handle billing entirely outside the app
  (e.g. manual invoicing or a billing provider) and change plans with direct
  database updates until a billing module is built.
- Email verification, password reset, 2FA, social login.
- Multiple stores per merchant (schema-ready; API/UI assume one).
- Product images/media uploads.
- Shipping-fee engine, coupons, taxes per region.
- Payment-gateway integrations (Paymob/Fawry/Mada) — COD + manual methods only.
- Admin/back-office UI (leads are API-only; use `GET /api/admin/leads` with an admin merchant + scripts).
- Audit logging of merchant actions.
- Automated DB backups (operator cron, see §4).
- Horizontal scaling notes: sessions live in Postgres (shared-nothing safe);
  use sticky-less replicas + a managed DB; rate limits are per-instance memory.
