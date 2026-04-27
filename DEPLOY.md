# helio-platform deployment

Production stack: 5 FastAPI agents + 1 control-plane service + 2 static
frontends, behind a single edge nginx, all on one Linux box. Supabase
provides Postgres + Auth + Storage as a hosted dependency (no local DB).

```
                         user (Framer SPA on platform.helio.ae)
                         admin    (admin.helio.ae)
                              │  HTTPS
                              ▼
                       ┌──────────────┐
                       │  edge nginx  │  TLS for api.helio.ae + admin.helio.ae
                       └──────┬───────┘
   ┌───────────────────────┬──┴──────┬─────────────┬──────────────┐
   ▼                       ▼         ▼             ▼              ▼
main-app SPA          admin SPA   tenant-api  image, video,    Supabase
(api.helio.ae /)   (admin.helio.ae/)  :8060   storyteller,     (hosted)
                                              campaign,
                                              soul-print agents
                                              (:8020-8070)
```

---

## 1. Prerequisites

- Linux host (Ubuntu 22.04+ tested) with public IP (`103.174.102.124`).
- Docker Engine + Compose v2.
- DNS A records:
  - `api.helio.ae`    → server IP
  - `admin.helio.ae`  → server IP
- Supabase project (URL + anon key + service-role key + JWKS URL).
- API tokens: `OPENROUTER_API_KEY`, `REPLICATE_API_TOKEN`.

---

## 2. First-time bootstrap

```bash
git clone https://github.com/bahram-m-doust/helioplatform.git /opt/helio-platform
cd /opt/helio-platform
cp .env.prod.example .env.prod
$EDITOR .env.prod   # fill in every value (see §3)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

The first build takes 5–10 minutes (8 images: 5 agents + tenant-api +
admin SPA + main-app shell + edge nginx). Once `docker compose ps`
shows everything Up, jump to §4 (DNS + TLS) and §5 (Supabase).

---

## 3. `.env.prod` reference

The file is annotated; the highlights:

| Group | Keys |
|---|---|
| **Public surface** | `PUBLIC_URL`, `PUBLIC_HTTP_PORT`, `PUBLIC_HTTPS_PORT` |
| **Agent providers** | `OPENROUTER_API_KEY`, `REPLICATE_API_TOKEN`, model overrides |
| **External `/v1/*`** | `HELIO_EXTERNAL_API_KEYS_{IMAGE,VIDEO,STORYTELLER,CAMPAIGN,SOUL_PRINT}` (one per integration), `HELIO_EXTERNAL_ALLOWED_ORIGIN_REGEX` |
| **Supabase** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL` |
| **tenant-api CORS** | `TENANT_API_ALLOWED_ORIGINS=https://admin.helio.ae` |

See `.env.prod.example` for the full annotated template.

---

## 4. DNS + TLS

### DNS

Set both A records before issuing certs:

```
api.helio.ae    A  103.174.102.124
admin.helio.ae  A  103.174.102.124
```

Verify propagation: `dig +short api.helio.ae` and `dig +short admin.helio.ae`.

### TLS bootstrap

Two separate Let's Encrypt certs, both webroot-issued (zero downtime):

```bash
sudo apt install -y certbot
sudo mkdir -p /var/www/certbot
# Make sure edge-nginx is up first (it serves /.well-known/acme-challenge/).
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d edge-nginx

sudo certbot certonly --webroot -w /var/www/certbot \
  -d api.helio.ae --non-interactive --agree-tos -m admin@helio.ae

sudo certbot certonly --webroot -w /var/www/certbot \
  -d admin.helio.ae --non-interactive --agree-tos -m admin@helio.ae

# Reload nginx so it picks up the cert files.
docker compose -f docker-compose.prod.yml --env-file .env.prod restart edge-nginx
```

Certbot auto-renews via the systemd timer that ships with the package
(`systemctl status certbot.timer`).

---

## 5. Supabase

Supabase is the **single source of truth** for tenant data: brands,
memberships, API keys, agent runs, subdomains. Initial setup:

```bash
# 1. Create a Supabase project and copy URL + anon key + service-role key
#    + JWKS URL into .env.prod.

# 2. Apply the migrations in order. `psql` works; the Supabase CLI also works.
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0002_rls.sql
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0003_seed.sql
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0004_rpc.sql
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0005_brand_seed_trigger.sql
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0006_signup_brand_link.sql
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0007_brand_agent_config_schema.sql
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0008_cost_summary_view.sql

# 3. Promote the first admin user (after they've signed up via the admin UI).
#    In the Supabase SQL editor:
#      update auth.users
#         set raw_app_meta_data = jsonb_set(
#           coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"helio_admin"'
#         )
#       where email = 'you@helio.ae';
```

RLS regression tests (`infra/supabase/tests/rls_isolation.sql`) require
pgTAP; run them before any schema PR lands.

---

## 6. Smoke checks

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
# Every service should be Up.

# Public endpoints (after DNS + TLS bootstrap):
curl -sI https://api.helio.ae/                               | head -1   # 200
curl -sI https://api.helio.ae/api/image/health               | head -1   # 200
curl -sI https://api.helio.ae/api/video/health               | head -1   # 200
curl -sI https://api.helio.ae/api/storyteller/health         | head -1   # 200
curl -sI https://api.helio.ae/api/campaign/health            | head -1   # 200
curl -sI https://api.helio.ae/api/soul-print/health          | head -1   # 200
curl -sI https://api.helio.ae/api/tenant/health              | head -1   # 200
curl -sI https://admin.helio.ae/                             | head -1   # 200
curl -sI http://api.helio.ae/                                | head -1   # 301 -> https
```

External `/v1/*` (X-API-Key path):

```bash
curl -sS -X POST https://api.helio.ae/v1/image/generate \
  -H "X-API-Key: $HELIO_EXTERNAL_API_KEYS_IMAGE" \
  -H "Content-Type: application/json" \
  -d '{"user_request":"Glass tower at golden hour","brand":"Binghatti"}'
```

---

## 7. Updating without downtime

| Touched files | Command |
|---|---|
| One agent (`agents/<name>/backend/**`)        | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build <name>-api` |
| Shared `packages/agent-common/**`             | rebuild every consumer: `… up -d --build image-generator-api video-generator-api storyteller-api campaign-maker-api soul-print-api tenant-api` |
| `services/tenant-api/**`                      | `… up -d --build tenant-api` |
| Admin SPA (`apps/admin/**`)                   | `… up -d --build admin-frontend` |
| Marketing/questionnaire shell (`apps/main-app/**`) | `… up -d --build main-app-frontend` |
| nginx (`infra/nginx/**`)                      | `… up -d --build edge-nginx` |
| Env-only change                               | `… up -d <service>` (no `--build` needed) |
| Supabase schema                               | apply the new migration via psql/Supabase CLI; `tenant-api` may need a restart so PyJWT cached JWKS is refreshed |

---

## 8. Common ops

### Rotate an external API key

```bash
# In the admin UI, brands/<slug> -> Issue key. Copy the secret once.
# To revoke an old key:
psql "$SUPABASE_DB_URL" -c \
  "update brand_api_keys set revoked_at = now() where prefix = 'helio_li';"
```

### Migrate legacy env-var keys into the DB (one-shot)

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
DEFAULT_BRAND_OWNER_USER_ID=<uuid> \
HELIO_EXTERNAL_API_KEYS_IMAGE='helio_live_xxx' \
HELIO_EXTERNAL_API_KEYS_VIDEO='helio_live_yyy' \
… \
python services/tenant-api/scripts/migrate_env_keys.py
```

### Inspect logs

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=200 -f tenant-api
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=200 -f image-generator-api
```

---

## 9. Upgrading from a pre-Phase-6 deployment

Phase 6 deleted the local Postgres + heliogram stack. If you are
upgrading an existing host:

```bash
# 1. Stop everything.
docker compose -f docker-compose.prod.yml --env-file .env.prod down

# 2. Pull the new code (this commit + later).
git pull --ff-only origin main

# 3. Provision Supabase (§5) before bringing services back up — agents
#    will 502 on every /v1 call until JWKS + the migrations are in
#    place if SUPABASE_URL is set without the schema applied.

# 4. Bring the new stack up.
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 5. Optional: drop the orphan volumes (they no longer have a service).
docker volume rm helio-platform-prod_prod_postgres_data
docker volume rm helio-platform-prod_prod_heliogram_storage
docker volume rm helio-platform-prod_prod_heliogram_media
docker volume rm helio-platform-prod_prod_heliogram_static
```

The HelioGram code lives at its extracted repo (see the
``heliogram-extract`` branch in this repo's history if you need to
push it elsewhere).

---

## 10. Troubleshooting cheatsheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `WARN The "X" variable is not set.` | Compose without `--env-file .env.prod`. | Add the flag. |
| /v1 calls return 502 with "Tenant directory unavailable." | Supabase env or migrations missing. | Verify `SUPABASE_URL`, `SUPABASE_JWKS_URL`, and that 0001-0008 are applied. |
| Browser CORS blocks calls from a Framer subdomain. | `HELIO_EXTERNAL_ALLOWED_ORIGIN_REGEX` doesn't match. | Default regex covers `*.platform.helio.ae`; tighten/extend if you use another domain. |
| Admin UI returns 401 on /me/brands | Caller is signed in but not in any `brand_members` row. | Add the user via tenant-api `/admin/brands/{id}` flow or directly via the admin UI's brand creation. |
| Cert renewal fails. | Webroot path mismatch. | Confirm `/var/www/certbot` is bind-mounted and reachable via `http://<host>/.well-known/acme-challenge/test`. |
