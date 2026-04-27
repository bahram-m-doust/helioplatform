# Helio Platform — backend API monorepo

Pure API backend for the Helio platform. Five FastAPI agents + one
control-plane service + a small admin SPA. The customer-facing site
lives on Framer (`platform.helio.ae`); this repo is `api.helio.ae` +
`admin.helio.ae` only.

## Layout

```
helio-platform/
├── apps/
│   ├── admin/                  # Internal admin SPA (Vite + React + Supabase)
│   └── main-app/               # Tiny questionnaire shell (will be retired
│                               # once the Framer flow takes over)
├── services/
│   └── tenant-api/             # FastAPI control plane (brand CRUD, key
│                               # issuance, Framer invites, /me/usage)
├── agents/
│   ├── image-generator/        # FastAPI :8020  Seedream 4.5
│   ├── video-generator/        # FastAPI :8030  Kling v2.5
│   ├── storyteller/            # FastAPI :8040  multi-profile chat
│   ├── campaign-maker/         # FastAPI :8050  multi-brand chat
│   └── soul-print/             # FastAPI :8070  Brand-as-City chat
├── packages/
│   └── agent-common/           # Shared Python lib (security, openrouter,
│                               # replicate, sanitize, tenant resolver, audit)
├── infra/
│   ├── nginx/prod/             # Edge nginx — TLS for api.helio.ae +
│   │                           #                       admin.helio.ae
│   ├── supabase/               # Migrations + RLS policies + pgTAP tests
│   └── scripts/                # agents-up.mjs (dev-only orchestrator)
├── docker-compose.prod.yml
└── docker-compose.yml          # Dev: agents only
```

## Architecture

- **Auth**: Supabase JWT (browser) **or** per-brand `X-API-Key`
  (server-to-server). Agents validate either via the shared
  `packages/agent-common.tenant.require_tenant` dependency.
- **Tenancy**: every request resolves to one `brand_id`. Agents apply
  per-brand prompt overrides (`brand_agents.config_json`), gate spend
  via `consume_brand_quota`, and append an audit row to
  `agent_runs` on every call.
- **Cost tracking**: `brand_cost_summary` view aggregates `agent_runs`
  per (brand, agent, month). Surfaced in the admin app's
  `/usage` page.
- **Backwards compatibility**: when `SUPABASE_URL` is unset every agent
  falls back to legacy env-var X-API-Key validation. Useful for local
  dev without a Supabase account.

## Running locally

Two paths — pick one.

### A. Docker (recommended for full-stack tests)

```bash
cp .env.example .env
$EDITOR .env                            # set OPENROUTER_API_KEY at minimum
docker compose up -d --build            # builds agents only (no DB needed)
```

Agents reach `localhost:8020`, `8030`, `8040`, `8050`, `8070`.

### B. Native venv (for fast iteration on agents)

```bash
cp .env.example .env
$EDITOR .env
npm install                             # only needed for the JS dev tools
npm run agents:up                       # spawns 5 uvicorns into agents/.venv
```

The admin SPA dev server runs separately:

```bash
cd apps/admin
npm install
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run dev
```

## Editing system prompts

Each agent loads its system prompt from a plain text file under
`agents/<name>/backend/app/prompts/`:

```
agents/image-generator/backend/app/prompts/{image_prompt_system,prompt_repair}.txt
agents/video-generator/backend/app/prompts/{kling,video_image_prompt_system,video_prompt_repair}.txt
agents/storyteller/backend/app/prompts/{brand-language,language-style}.txt
agents/campaign-maker/backend/app/prompts/{binghatti,mansory,technogym}.txt
agents/soul-print/backend/app/prompts/soul_print.txt
```

Edit the file, restart the affected agent, and the new prompt takes
effect immediately. Per-brand overrides live in
`brand_agents.config_json.system_prompt_override` (see
`infra/supabase/migrations/0007_brand_agent_config_schema.sql`).

## Deployment

See [DEPLOY.md](DEPLOY.md) for the production runbook (DNS, TLS,
Supabase migrations, smoke checks, troubleshooting).

## HelioGram

The community / messaging app that used to live in `apps/heliogram/`
was extracted to its own repo at the end of Phase 6. The history is
preserved on the `heliogram-extract` branch in this repo and can be
pushed to `github.com/helio/heliogram` when needed.
