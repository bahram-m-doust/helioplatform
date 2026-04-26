# Campaign-Maker — External API (`/v1`)

Public surface for third-party sites. Reachable through the edge nginx
at `https://api.helio.ae/v1/campaign/...`. Internal `/api/...` routes
used by the main-app frontend stay in `app/api/routes/chat.py`.

## Authentication

```
X-API-Key: <your-secret>
```

Configured via `HELIO_EXTERNAL_API_KEYS_CAMPAIGN` (comma-separated
`label:secret` pairs, constant-time compared).

## Rate limiting

Per-key token bucket. Default 30 req/min, burst 10.

## CORS

Browser callers must come from an origin in
`HELIO_EXTERNAL_ALLOWED_ORIGINS`.

## Endpoint

### `POST /v1/chat`

```json
{
  "brand": "Binghatti",
  "messages": [
    { "role": "user", "content": "Plan a 4-week launch campaign for a new penthouse line." }
  ]
}
```

```json
{
  "status": "ok",
  "brand": "Binghatti",
  "reply": "..."
}
```

`brand` must be one of `Mansory`, `Technogym`, `Binghatti`. `messages`
is capped at `HELIO_EXTERNAL_MAX_MESSAGES` (default 20); each content is
capped at `HELIO_EXTERNAL_MAX_MESSAGE_CHARS` (default 4000).

## Errors

| Status | Meaning                                  |
|-------:|------------------------------------------|
| 400    | Validation failed                        |
| 401    | Missing or invalid `X-API-Key`           |
| 429    | Rate limit exceeded                      |
| 502    | Upstream provider failed                 |
| 503    | External API not configured on server    |
