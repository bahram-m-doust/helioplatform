# Deploy Guide — Production (Docker)

This guide documents the **actual** production setup used on
`103.174.102.124` and, more importantly, how to roll out code/config updates
without downtime for the parts that do not need to change.

The dev stack (`docker-compose.yml` + `.env`) is a separate world and is not
touched by any command in this guide.

---

## 1. Architecture at a glance

All traffic terminates on a single public port (`:80`) inside the
`edge-nginx` container. Everything else is private to the internal docker
network.

```
                                +----------------------+
  Browser -> :80 edge-nginx --> | main-app-frontend    |  /
                                | heliogram-frontend   |  /heliogram/
                                | heliogram-backend    |  /api/ /admin/ /static/ /media/
                                | image-generator-api  |  /api/image/*
                                | video-generator-api  |  /api/video/*
                                | storyteller-api      |  /api/storyteller/*
                                | campaign-maker-api   |  /api/campaign/*
                                | db (postgres:16)     |  (internal only)
                                +----------------------+
```

Source of truth:
- `docker-compose.prod.yml` — service graph, volumes, upstream names.
- `infra/nginx/prod/nginx.conf` — edge routing rules.
- `.env.prod` — all secrets and per-deployment values. Lives only on the
  server. See `SECRETS.local.md` (git-ignored) for the concrete values of
  this deployment.

---

## 2. Server prerequisites

Ubuntu 22.04 (or newer) with:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates
# Docker Engine + Compose v2 plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # log out + back in, or use `sudo` for docker
```

Confirm:

```bash
docker --version
docker compose version
```

---

## 3. First-time deploy (bootstrap)

Only needed once per server. Skip to §4 for every subsequent update.

```bash
sudo mkdir -p /opt && cd /opt
sudo git clone https://github.com/bahram-m-doust/helioplatform.git helio-platform
sudo chown -R $USER:$USER helio-platform
cd helio-platform

# Build the production env file from the template and fill in every value.
cp .env.prod.example .env.prod
chmod 600 .env.prod
nano .env.prod
# Values to set: SECRET_KEY, DJANGO_SUPERUSER_*, DB_PASSWORD,
# OPENROUTER_API_KEY, REPLICATE_API_TOKEN, VITE_OPENROUTER_API_KEY, ...
# See SECRETS.local.md on a trusted machine for the reference values.

# Generate a fresh SECRET_KEY if you do not already have one:
python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# First boot — builds every image and creates volumes.
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Verify.
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f heliogram-backend
```

Expect the backend log to show `Applying migrations`, `Created superuser
'<name>'`, then `Listening at: http://0.0.0.0:8010`.

Browse:
- `http://<public-ip>/`          → main-app SPA
- `http://<public-ip>/heliogram/` → HelioGram community SPA
- `http://<public-ip>/admin/`    → Django admin (log in with the seeded
                                   superuser).

> **One-time hygiene.** After the first login, change the admin password
> (see §5.1) so the value that lived in `.env.prod` at bootstrap stops
> being the active one.

---

## 4. Update workflow (the common case)

From your workstation, work on `main`, commit, push:

```bash
git pull --rebase
# ...edits...
git add -A
git commit -m "..."
git push origin main
```

Then on the server:

```bash
cd /opt/helio-platform
git pull --ff-only origin main
```

Now pick the smallest possible rollout based on **what you changed**. The
table below covers every recurring case. All commands assume
`cd /opt/helio-platform`.

| What changed                                                     | Command (rebuild only what you need)                                                                                       |
|------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| Django backend code or migrations (`apps/heliogram/backend/**`)  | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build heliogram-backend`                           |
| A single agent (e.g. image-generator)                            | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build image-generator-api`                         |
| HelioGram community SPA (`apps/heliogram/frontend/**`)           | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build heliogram-frontend`                          |
| Main-app SPA **without** VITE_\* changes                         | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build main-app-frontend`                           |
| Main-app SPA **and** VITE_\* vars changed in `.env.prod`         | `docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache main-app-frontend` then `up -d`           |
| `infra/nginx/prod/**` (routing / headers)                        | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build edge-nginx`                                  |
| Runtime env only (e.g. toggled `EMAIL_HOST`)                     | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d <service>` (no `--build`)                            |
| Build-time env only (any `VITE_\*`)                              | Always rebuild the frontend(s) with `--build --no-cache` — Vite bakes these into the static bundle.                        |

**Why `--build` per service and not `--build` global?** `--build` on its
own rebuilds every image, which is 5–10× slower and rebuilds things that
did not change. Rebuild only the service you touched.

**Why `--no-cache` for VITE\_ changes?** Docker's layer cache sees a
`COPY` + `npm run build` and reuses the previous layer because the source
didn't change; but your Vite variables did change at build time. Passing
`--no-cache` forces the build layer to rerun and re-bake the env.

### 4.1 Full restart (rarely needed)

Only if you genuinely want to recreate every container (e.g. after
changing `docker-compose.prod.yml` itself):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

**Never pass `-v`** on a working deployment. `docker compose down -v` wipes
the Postgres volume and destroys all user data.

### 4.2 Rolling back a bad deploy

```bash
cd /opt/helio-platform
git log --oneline -n 10            # pick the last good commit
git reset --hard <sha>              # reset local tree to it
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build <service(s) you rebuilt>
```

Postgres migrations are **not** auto-reverted by `git reset`. If your bad
deploy included a migration, roll that back explicitly:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec heliogram-backend \
    python manage.py migrate <app> <previous_migration_name>
```

---

## 5. Admin & operations

### 5.1 Change the Django superuser password

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec heliogram-backend \
    python manage.py changepassword <username>
```

Do this once after the first boot, and any time you rotate credentials.
`DJANGO_SUPERUSER_PASSWORD` in `.env.prod` is **only** honored when the user
does not yet exist; updating the env file afterwards has no effect.

### 5.2 Open a Django shell

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec heliogram-backend \
    python manage.py shell
```

### 5.3 Postgres backup / restore

```bash
# Backup to ./backups/<timestamp>.sql.gz
mkdir -p backups
ts=$(date +%Y%m%d-%H%M%S)
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db \
    pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "backups/${ts}.sql.gz"

# Restore (careful — drops and recreates the DB schema).
gunzip -c backups/<file>.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db \
    psql -U "$DB_USER" "$DB_NAME"
```

### 5.4 Inspect logs

```bash
# Live tail of one service.
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f heliogram-backend

# Last 200 lines, multi-service.
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=200 \
    heliogram-backend image-generator-api video-generator-api
```

### 5.5 Rotate an API key (OpenRouter / Replicate)

1. Revoke the old key in the provider dashboard.
2. Put the new value in `.env.prod` on the server.
3. Restart only the services that read it — agent containers + the
   main-app frontend if you rotated `VITE_OPENROUTER_API_KEY`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d \
    image-generator-api video-generator-api storyteller-api campaign-maker-api

# Only needed if VITE_* changed (build-time bake):
docker compose -f docker-compose.prod.yml --env-file .env.prod \
    build --no-cache main-app-frontend
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d main-app-frontend
```

4. Update the corresponding entry in `SECRETS.local.md` on your
   workstation.

---

## 6. Secrets

### 6.1 What lives where

| File                         | Committed to git? | Purpose                                                                             |
|------------------------------|-------------------|-------------------------------------------------------------------------------------|
| `.env.prod.example`          | Yes               | Template with every variable explained and **no** real values.                      |
| `.env.prod` (on the server)  | No (git-ignored)  | The actual values the running stack reads. Lives at `/opt/helio-platform/.env.prod`.|
| `SECRETS.local.md`           | No (git-ignored)  | Human-readable reference kept on trusted machines; mirrors `.env.prod`.             |
| `apps/heliogram/.env`        | No (git-ignored)  | Local dev values for the Django backend when running `npm run dev`.                 |
| `.env`                       | No (git-ignored)  | Local dev values for Vite / the monorepo.                                           |

The `.gitignore` at the repo root enforces all of the "No" rows via an
`!*.env.example` negation on top of `.env*` — so you can freely drop new
`<name>.env.example` templates next to services, but any actual env file
(regardless of suffix) stays out of git.

### 6.2 Keeping real values around safely

Do **not** paste production secrets into git commits, chat logs, or
screenshots. The canonical storage for this deployment is:

- On the production server: `/opt/helio-platform/.env.prod` (`chmod 600`).
- On your workstation: `SECRETS.local.md` in the repo root — git-ignored by
  the pattern `SECRETS.local.md` (and friends) in `.gitignore`.

If a secret does leak (pushed by mistake, screenshotted, emailed), rotate
it: follow §5.5.

### 6.3 Generating a new `SECRET_KEY`

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Replace the value in `.env.prod` and restart the backend:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d heliogram-backend
```

Django sessions signed with the old key become invalid — all users will
need to log in again. That's expected; the downside is only inconvenience.

---

## 7. Smoke checks

```bash
cd /opt/helio-platform
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
# Every container should be Up; db should be Up (healthy).

# From the server itself:
curl -sI -H 'Host: 103.174.102.124' http://127.0.0.1/            | head -1   # 200
curl -sI -H 'Host: 103.174.102.124' http://127.0.0.1/heliogram/  | head -1   # 200
curl -sI -H 'Host: 103.174.102.124' http://127.0.0.1/admin/      | head -1   # 302 (redirect to /admin/login/)
curl -sI -H 'Host: 103.174.102.124' http://127.0.0.1/api/image/health  | head -1   # 200
```

If the backend is stuck in a restart loop, read its log — Django prints the
exact `SystemCheckError` or migration error on startup:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100 heliogram-backend
```

---

## 8. Troubleshooting cheatsheet

| Symptom                                                                      | Likely cause                                                                                                                   | Fix                                                                                                                       |
|------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `WARN[0000] The "X" variable is not set. Defaulting to a blank string.`      | Compose was invoked without `--env-file .env.prod`.                                                                            | Re-run with the flag. Never rely on shell env for prod values.                                                            |
| `heliogram-backend` in `Restarting (1)` loop, log shows `corsheaders.E014`.  | `CORS_ALLOWED_ORIGINS` contains a URL with a path.                                                                             | Fixed in code (`settings.py` now strips the path). Pull latest `main` and rebuild `heliogram-backend`.                    |
| Image / video / storyteller / campaign UI returns `Not Found` for API calls. | Nginx rewrite double-prefixed `/api/`.                                                                                         | Fixed in `infra/nginx/prod/nginx.conf`. Rebuild `edge-nginx`.                                                             |
| `psql: error: connection to server ... FATAL: password authentication failed`| `DB_PASSWORD` in `.env.prod` does not match what Postgres persisted in its volume.                                             | Either revert `DB_PASSWORD` to what the volume expects, or accept data loss and recreate: `docker compose down -v` (⚠️).  |
| Frontend change deployed but UI still shows old strings.                     | Browser / CDN cache, or Vite bake cache.                                                                                       | Hard-refresh the browser (Ctrl+Shift+R). If VITE_* changed, rebuild frontend with `--no-cache`.                           |
| `/admin/` returns `400 Bad Request` from curl but works in the browser.      | Django `ALLOWED_HOSTS` doesn't include `127.0.0.1`. Harmless — reach it with `-H 'Host: <public-ip>'` or just use the browser. | No fix needed unless you want to curl it from localhost.                                                                   |

---

## Appendix: legacy files

The following files remain in the repo from the pre-docker era and are
**not used** by the production setup documented above. They are kept
untouched for now so that a future native-mode redeploy can reference
them, but feel free to delete if you never intend to use them:

- `infra/scripts/systemd/heliogram-backend.service`
- `infra/scripts/systemd/heliogram-frontend.service`
- `infra/nginx/nginx.conf` (root-level, non-docker)
- `infra/nginx/community.single-domain.conf`
- `infra/nginx/community.subdomains.conf`
