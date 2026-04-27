# Campaign-Maker — External API (`/v1`)

Public surface for third-party sites. Reachable through the edge nginx
at `https://api.helio.ae/v1/campaign/...`. Internal `/api/...` routes
used by the admin app stay in `app/api/routes/chat.py`.

## Authentication

Two paths:

  - **Supabase JWT** (browser callers from `*.platform.helio.ae`).
  - **Per-brand `X-API-Key`** (server-to-server).

In legacy mode (no `SUPABASE_URL`) the X-API-Key flow validates against
`HELIO_EXTERNAL_API_KEYS_CAMPAIGN`; the JWT path returns `503`.

## Per-brand behaviour

`brand_agents.config_json.system_prompt_override` replaces the
brand-driven system prompt. Disabled / unpublished brands return
`403 agent_not_published`.

The `brand` request field is the **input brand to model** (Mansory,
Technogym, Binghatti) — independent of the **tenant brand** that
authenticates the request. A tenant can run campaign-maker against any
of the three modeled brands as long as their override + quota allow it.

## Quota

Cost: **2 cents/turn** by default. Debited via `consume_brand_quota`.
`402` on exhaustion.

## Rate limiting

30 r/m + burst 10 per key by default. Plus the nginx 60 r/m IP layer.

## Endpoint

### `POST /v1/chat`

Multi-turn chat. Caller resends the full transcript on every request.

Request:

```json
{
  "brand": "Binghatti",
  "messages": [
    { "role": "user", "content": "Plan a 4-week launch campaign for a new penthouse line." }
  ]
}
```

Response:

```json
{
  "status": "ok",
  "brand": "Binghatti",
  "reply": "..."
}
```

`brand` must be one of `Mansory`, `Technogym`, `Binghatti`. `messages`
is capped at `HELIO_EXTERNAL_MAX_MESSAGES` (default 20); each `content`
is capped at `HELIO_EXTERNAL_MAX_MESSAGE_CHARS` (default 4000).

## Audit

One `agent_runs` row per turn.

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
