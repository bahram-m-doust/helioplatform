# Helio Platform

Monorepo structure aligned with the target foldering:

- `apps/main-app/frontend` main website (Vite + React + TypeScript)
- `apps/heliogram/frontend` community frontend
- `apps/heliogram/backend` community backend (Django)
- `agents/*` reserved per-agent frontend/backend slices
- `infra/*` runtime scripts + nginx/certbot templates

## Architecture (source of truth)

- Generation APIs for image and video currently live in the Heliogram Django backend:
  - Image: [apps/heliogram/backend/apps/agents/image_generator/api.py](apps/heliogram/backend/apps/agents/image_generator/api.py)
  - Video: [apps/heliogram/backend/apps/agents/video_generator/api.py](apps/heliogram/backend/apps/agents/video_generator/api.py)
- `agents/*` at the repo root host per-agent UI and FastAPI scaffolding (health only for now). They are intentionally thin; the runtime behavior stays in Heliogram until a dedicated microservice is introduced.
- Shared prompt loading utility: [apps/heliogram/backend/heliogram_core/prompt_loader.py](apps/heliogram/backend/heliogram_core/prompt_loader.py).

## Editing System prompts without changing code

All LLM system prompts for image and video are loaded from plain text files on disk, with a safe in-code fallback. Edit the file, restart the backend, and the new prompt takes effect.

- Image generator prompts: `apps/heliogram/backend/apps/agents/image_generator/prompts/`
  - `image_prompt_system.txt`
  - `prompt_repair.txt`
- Video generator prompts: `apps/heliogram/backend/apps/agents/video_generator/prompts/`
  - `kling.txt`
  - `video_image_prompt_system.txt`
  - `video_prompt_repair.txt`

Both `.txt` and `.md` are supported (content is read literally and passed as the system message).

## Local Run

1. Install root dependencies:
   ```bash
   npm install
   ```
2. Copy root env:
   ```bash
   cp .env.example .env
   ```
3. Start everything:
   ```bash
   npm run dev
   ```

`npm run dev`:
- starts Community via `infra/scripts/community-up.mjs` (`COMMUNITY_RUN_MODE` default: `native`)
- starts main site on `http://localhost:4000`

Expected URLs:
- Main site: `http://localhost:4000`
- HelioGram frontend: `http://localhost:5050`
- HelioGram backend: `http://localhost:8010`
- Health: `http://localhost:8010/api/health/`

## Useful Commands

- `npm run community:up`
- `npm run community:down`
- `npm run community:logs`
- `npm run build`
- `npm run lint`

## Environment (Root `.env`)

- `VITE_OPENROUTER_API_KEY`
- `VITE_OPENROUTER_MODEL` (default: `openai/gpt-4o`)
- `VITE_OPENROUTER_FALLBACK_MODELS`
- `VITE_COMMUNITY_URL` (default: `http://localhost:5050`)
- `VITE_HELIOGRAM_API_BASE_URL` (recommended in LAN/VPS; example `http://localhost:8010`)
- `VITE_IMAGE_PROMPT_API_URL` / `VITE_IMAGE_GENERATION_API_URL` (optional overrides)
- `VITE_VIDEO_IMAGE_PROMPT_API_URL` / `VITE_VIDEO_PROMPT_FROM_IMAGE_API_URL` / `VITE_VIDEO_GENERATION_API_URL` (optional overrides)
- `REPLICATE_API_TOKEN`
- `REPLICATE_IMAGE_MODEL` (default: `bytedance/seedream-4.5`)
- `REPLICATE_VIDEO_MODEL` (default: `kwaivgi/kling-v2.5-turbo-pro`)
- `IMAGE_PROMPT_LLM_MODEL` (default: `openai/gpt-4o`)
- `VIDEO_PROMPT_LLM_MODEL` (default: `openai/gpt-4o`)
- `COMMUNITY_RUN_MODE` (`native|docker|auto`, default: `native`)
- `COMMUNITY_BACKEND_PORT` (default: `8010`)
- `COMMUNITY_FRONTEND_PORT` (default: `5050`)
- `COMMUNITY_AUTO_MIGRATE` (default: `true`)

## Deploy

Production guide:
- [DEPLOY.md](DEPLOY.md)

HelioGram app notes:
- [apps/heliogram/README.md](apps/heliogram/README.md)
