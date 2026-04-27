# Soul-Print — External API (`/v1`)

Public surface for third-party sites. Reachable through the edge nginx
at `https://api.helio.ae/v1/soul-print/...`. Internal `/api/...` route
used by the admin app stays in `app/api/routes/chat.py`.

## Authentication

Two paths:

  - **Supabase JWT** (browser callers from `*.platform.helio.ae`).
  - **Per-brand `X-API-Key`** (server-to-server).

In legacy mode (no `SUPABASE_URL`) the X-API-Key flow validates against
`HELIO_EXTERNAL_API_KEYS_SOUL_PRINT`; the JWT path returns `503`.

## Per-brand behaviour

Soul-Print runs the canonical "Brand-as-City" system prompt unless
the brand's `brand_agents.config_json.system_prompt_override` is set.
Disabled / unpublished brands return `403 agent_not_published`.

## Quota

Cost: **4 cents/turn** by default (longer transcripts than the other
chat agents). Debited via `consume_brand_quota`. `402` on exhaustion.

## Rate limiting

15 r/m + burst 5 per key by default — Soul-Print conversations are
long-form and burst small. Plus the nginx 60 r/m IP layer.

## Endpoint

### `POST /v1/chat`

Multi-turn chat. Caller resends the full transcript on every request.
The agent walks the user through a structured discovery flow (founder
identity → city model → Story of City).

Request:

```json
{
  "messages": [
    { "role": "user", "content": "I'm Sara, founding partner of an architecture studio in Dubai." }
  ]
}
```

Response:

```json
{
  "status": "ok",
  "reply": "..."
}
```

`messages` capped at `HELIO_EXTERNAL_MAX_MESSAGES` (default 60); each
`content` capped at `HELIO_EXTERNAL_MAX_MESSAGE_CHARS` (default 6000)
to allow long discovery answers.

## Welcome message

`GET /api/welcome` returns the canonical opening line — handy for an
admin / Framer UI that shows it before the user types. No auth.

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
