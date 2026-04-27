# CLAUDE.md

Working notes for AI assistants editing this repo. Read once at the
start of a session.

## What this repo is

Pure API backend for the **Helio Platform**. Five FastAPI agents +
one control-plane service + an admin SPA, behind a single edge nginx.
Multi-tenant via Supabase RLS. Customer-facing site lives on Framer
(`platform.helio.ae`); this repo serves `api.helio.ae` + `admin.helio.ae`
**only**.

## Layout — the short version

```
agents/{image,video,storyteller,campaign,soul-print}-generator/backend/
        └── FastAPI per-agent service. Internal /api/* (admin) +
            external /v1/* (customers). Imports from packages/agent-common.

services/tenant-api/
        └── FastAPI control plane. /me/* (RLS-scoped) + /admin/* + /framer/invite.
            ONLY service that holds SUPABASE_SERVICE_ROLE_KEY.

apps/admin/         Vite + React + TS internal SPA (admin.helio.ae)
apps/main-app/      Tiny questionnaire shell. Will be retired.

packages/agent-common/agent_common/
        ├── http_client, openrouter, replicate, sanitize, prompt_loader,
        ├── security/      X-API-Key, token-bucket, security-headers middleware
        ├── external_config (parametric per-agent config)
        └── tenant/        TenantContext, JWKS verifier, members cache,
                           supabase_client, audit, resolver

infra/nginx/prod/   Edge nginx with map $host $root_upstream
infra/supabase/     migrations/{0001..0008}.sql + policies/ + tests/
```

## Multi-tenant model — read this before changing /v1 code

Every `/v1/*` request resolves to **one `brand_id`** via
``packages/agent-common/agent_common/tenant/resolver.py::build_tenant_resolver``.

Two auth paths, both end with the same ``TenantContext``:

  1. **JWT path** (browser, `Authorization: Bearer <supabase_jwt>`):
     verify against Supabase JWKS (1h cached), read
     ``app_metadata.brand_id`` claim, confirm membership in
     ``brand_members`` (60s cached), cross-check ``Origin`` subdomain
     against ``brand_subdomains``.
  2. **X-API-Key path** (server-to-server, `X-API-Key: helio_live_…`):
     SHA-256 the secret, look it up via the ``resolve_brand_api_key``
     SECURITY DEFINER RPC, apply per-key token bucket.

**Backwards compat**: when ``SUPABASE_URL`` is unset, the resolver
falls back to ``agent_common.security.build_security`` (legacy env-var
X-API-Key validation) and emits a synthetic ``TenantContext`` with
``brand_id = "00000000-0000-0000-0000-000000000000"`` (sentinel). The
audit / quota / per-brand-config helpers detect the sentinel and
silently no-op. **JWT path returns 503 in legacy mode.**

After resolution, every route handler:

  1. Calls ``get_brand_agent_config`` — None means "agent not
     published for this brand", return 403.
  2. Calls ``consume_brand_quota`` — False means "monthly budget
     exhausted", return 402.
  3. Runs the LLM / Replicate work.
  4. Calls ``record_run`` to append an ``agent_runs`` row (success or
     failure).

The ``image-generator`` ``routes.py`` is the canonical reference
implementation; the other four agents follow the same shape.

## Security invariants (CI guards — see .github/workflows/ci.yml)

  - ``SUPABASE_SERVICE_ROLE_KEY`` is referenced **only** in
    ``services/tenant-api/``. Never in agents, packages, or apps.
    Agents reach service-role-equivalent power via narrow
    ``SECURITY DEFINER`` RPCs (``resolve_brand_api_key``,
    ``consume_brand_quota``, ``record_agent_run``,
    ``get_brand_agent_config``) defined in ``0004_rpc.sql``.
  - ``VITE_OPENROUTER_*`` is **never** in any frontend tree.
    The OpenRouter token has been moved fully server-side; the
    soul-print agent (Phase 5) replaced the old browser-side call.
  - Supabase migrations are **plain SQL only** — no ``\ir`` or
    other psql meta-commands. Migration 0002 used to use ``\ir``;
    we inlined every policy because the Supabase CLI's pg-protocol
    path doesn't run psql meta-commands.

## How to verify your changes

Run these in roughly this order. They mirror the CI workflow.

```bash
# SQL: parens balanced, no dangling commas, no \ir
for f in infra/supabase/migrations/*.sql; do
  python3 -c "
import re, sys
sql = open('$f').read()
o, c = sql.count('('), sql.count(')')
assert o == c and not re.search(r',\s*\)', sql), '$f'"
done

# Frontend
npm run lint                                    # main-app
( cd apps/admin && npm run lint )               # admin SPA

# Agents + tenant-api boot cleanly
pip install -e packages/agent-common
for d in agents/image-generator agents/video-generator agents/storyteller \
         agents/campaign-maker agents/soul-print services/tenant-api; do
  ( cd "$d/backend" 2>/dev/null || cd "$d"; python3 -c "
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as c:
    assert c.get('/health').status_code == 200")
done

# Regression on each /v1 in legacy mode (no SUPABASE_URL)
# (See .github/workflows/ci.yml for the per-agent check matrix.)
```

## Conventions

  - **Per-agent shims**: each agent's
    ``app/services/{openrouter,replicate,sanitize,prompts}.py`` is a
    thin wrapper that pre-binds the agent's env-var names + service
    title and forwards to ``agent_common``. Don't reintroduce the
    pre-Phase-1 duplication.
  - **Per-agent external surface**: ``app/external/{config,security,
    schemas,routes}.py``. ``security.py`` builds the per-agent tenant
    resolver via ``build_tenant_resolver(config=CONFIG)``. New agents
    follow this exact shape.
  - **API-key issuance**: secret = ``"helio_live_" +
    secrets.token_urlsafe(32)``; we store ``sha256(secret)`` only.
    The plaintext is shown **once** at issuance. See
    ``services/tenant-api/app/routes/admin_brands.py`` and
    ``services/tenant-api/scripts/migrate_env_keys.py``.
  - **Build context for every Dockerfile is the repo root**, so each
    image can ``COPY packages/agent-common``. Per-Dockerfile
    ``Dockerfile.dockerignore`` files trim the upload.

## Phase reference

The plan that drove the build is at
``/root/.claude/plans/heliogram-zany-crane.md`` (when running in this
sandbox). Six phases shipped:

  1. Cleanup + extract ``packages/agent-common`` (~350 LOC dedup).
  2. Supabase schema + RLS + ``tenant-api`` skeleton.
  3. Multi-tenant agents (require_tenant + audit + quota +
     per-brand prompt overrides) with backwards-compat fallback.
  3.5. signup trigger (0006), Framer invite endpoint, Mansory +
     Technogym seed, typed config_json (0007), httpx lifespan.
  4. Wildcard CORS for ``*.platform.helio.ae`` + ``admin.helio.ae``
     server block.
  5. ``agents/soul-print/`` (closes the OpenRouter browser leak),
     ``brand_cost_summary`` view (0008), ``apps/admin/``,
     ``main-app`` strip.
  6. HelioGram extracted to ``heliogram-extract`` branch and removed.

The migration history is preserved on the branch; pushing it to a new
repo is a manual step the operator runs when ready.

## Common pitfalls to avoid

  - **Don't put credentials in ``VITE_*``** — those are baked into
    the browser bundle. Server secrets live in plain (non-prefixed)
    env vars and are read in Python.
  - **Don't add ``\ir`` to migrations** — they don't run via the
    Supabase CLI. Inline the SQL or split into separate migration
    files.
  - **Don't change ``LEGACY_BRAND_ID``** — it's a sentinel that
    audit/quota/config helpers check for to no-op in legacy mode.
    Changing it silently breaks backwards compatibility.
  - **Don't reach for the service-role key from an agent**. If you
    need a privilege the anon key + RLS doesn't grant, add a
    SECURITY DEFINER RPC to ``infra/supabase/migrations/`` instead
    and call it via PostgREST.
