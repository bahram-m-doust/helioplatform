# Storyteller — External API (`/v1`)

Public surface for third-party sites. Reachable through the edge nginx
at `https://api.helio.ae/v1/storyteller/...`. Internal `/api/...`
routes used by the admin app stay in `app/api/routes/chat.py`.

## Authentication

Two paths:

  - **Supabase JWT** (browser callers from `*.platform.helio.ae`).
  - **Per-brand `X-API-Key`** (server-to-server).

In legacy mode (no `SUPABASE_URL`) the X-API-Key flow validates against
`HELIO_EXTERNAL_API_KEYS_STORYTELLER`; the JWT path returns `503`.

## Per-brand behaviour

`brand_agents.config_json.system_prompt_override` replaces the
profile-driven system prompt for the brand. Disabled / unpublished
brands return `403 agent_not_published`.

The `profile` request field selects between the agent's two voices
(`Brand Language` and `Language Style`); the brand override, when
present, takes precedence over both.

## Quota

Cost: **2 cents/turn** by default. Debited via `consume_brand_quota`.
`402` on exhaustion.

## Rate limiting

30 r/m + burst 10 per key by default. Plus the nginx 60 r/m IP layer.

## Endpoint

### `POST /v1/chat`

Multi-turn chat — the caller resends the full transcript on every
request and gets back a single reply. Same shape as
campaign-maker / soul-print.

Request:

```json
{
  "profile": "Brand Language",
  "messages": [
    { "role": "user", "content": "Write a 90-word brand origin story for a Dubai architecture studio." }
  ]
}
```

Response:

```json
{
  "status": "ok",
  "profile": "Brand Language",
  "reply": "..."
}
```

`profile` must be `Brand Language` or `Language Style`. `messages` is
capped at `HELIO_EXTERNAL_MAX_MESSAGES` (default 20); each `content`
is capped at `HELIO_EXTERNAL_MAX_MESSAGE_CHARS` (default 4000).

## Audit

One `agent_runs` row per turn, with `cost_usd`, `duration_ms`, and the
profile in `request_payload`.

## Errors

| Status | Meaning |
|-------:|---------|
| 400    | Validation failed |
| 401    | Missing or invalid auth |
| 402    | Brand quota exhausted |
| 403    | Not a member / agent not published / subdomain mismatch |
| 429    | Rate limit exceeded |
| 502    | Upstream provider failed |
| 503    | External API / Supabase not configured |
