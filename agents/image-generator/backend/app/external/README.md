# Image-Generator — External API (`/v1`)

Public surface for third-party sites (Framer per-brand subdomains,
custom landing pages, server-to-server integrations). Reachable
through the edge nginx at `https://api.helio.ae/v1/image/...`.

The internal `/api/...` routes used by the admin app stay unchanged in
`app/api/routes/image.py`.

## Authentication — two paths

Every request authenticates via **one** of the following:

### A. Supabase JWT (browser callers)

```
Authorization: Bearer <supabase_access_token>
```

Used by `*.platform.helio.ae` (Framer per-brand subdomains) where the
end user has a Supabase session. The agent validates the JWT against
`SUPABASE_JWKS_URL` (1h cache), reads `app_metadata.brand_id`, confirms
the user is a member of that brand, and cross-checks the `Origin`
subdomain against `brand_subdomains`. Mismatch / non-member = `403`.

### B. Per-brand `X-API-Key` (server-to-server)

```
X-API-Key: helio_live_<32-byte-urlsafe>
```

Used by partner backends, Zapier, n8n, etc. The agent SHA-256s the
secret, looks it up in `brand_api_keys` (a SECURITY DEFINER RPC; the
agent never holds the service-role key), and resolves to one
`brand_id`. Per-key token-bucket rate limit applies.

**Legacy mode**: when `SUPABASE_URL` is unset (deployment hasn't
adopted the multi-tenant control plane yet), the X-API-Key path falls
back to validating against the `HELIO_EXTERNAL_API_KEYS_IMAGE` env var.
JWT requests in legacy mode return `503` with a clear "JWT auth not
configured" detail.

Either path produces a `TenantContext` that scopes every downstream
operation (audit log, quota check, per-brand prompt override).

## Per-brand behaviour

Once the tenant is resolved, the agent reads
`brand_agents.config_json` (defined by migration
`0007_brand_agent_config_schema.sql`) and applies per-brand overrides:

```json
{
  "system_prompt_override": "...",   // replaces the static prompt
  "tone": "luxurious",
  "language": "en",
  "persona": "architect",
  "restricted_topics": ["politics", "religion"]
}
```

If the agent isn't `enabled + published_at IS NOT NULL` for the brand,
the request returns `403 agent_not_published`.

## Quota

Before invoking Replicate, the agent debits `cost_cents=8` from
`brand_quotas` via the `consume_brand_quota` RPC (atomic + row-locked).
Budget exhaustion returns `402`. Set
`brand_quotas.monthly_budget_cents = 0` for unlimited.

## Rate limiting

Two layers:

  1. **nginx** `limit_req` per real client IP (60 r/m, burst 30) —
     stops scrapers before they reach FastAPI.
  2. **Per-key / per-user token bucket** in agent_common (30 r/m, burst
     10 by default; tunable via `HELIO_EXTERNAL_RATE_PER_MINUTE` /
     `HELIO_EXTERNAL_RATE_BURST`). Returns `429` with `Retry-After`.

## CORS

  - Exact-match allowlist via `HELIO_EXTERNAL_ALLOWED_ORIGINS`.
  - Wildcard regex via `HELIO_EXTERNAL_ALLOWED_ORIGIN_REGEX`
    (production default: `^https://([a-z0-9-]+\.)?platform\.helio\.ae$`).

Server-to-server callers ignore CORS entirely.

## Endpoint

### `POST /v1/generate`

Single-call generation. Returns the rendered image URL plus the prompt
that was used (so the caller can show or store it).

Request:

```json
{
  "user_request": "A glass tower at golden hour over the Dubai skyline.",
  "brand": "Binghatti",
  "reference_images": []
}
```

Response:

```json
{
  "status": "succeeded",
  "image_url": "https://replicate.delivery/.../out.png",
  "prompt": "Subject-first photographic render of ...",
  "brand": "Binghatti"
}
```

## Audit

Every call (success or failure) appends a row to `agent_runs` with
`brand_id`, `user_id` (or `api_key_id`), `cost_usd`, `duration_ms`, and
`error_code`. Visible in the admin app at `/runs` and rolled up at
`/usage`.

## Error shape

All errors return `{"detail": "..."}` with a meaningful HTTP status:

| Status | Meaning                                  |
|-------:|------------------------------------------|
| 400    | Validation failed (see `detail`)         |
| 401    | Missing or invalid auth                  |
| 402    | Brand quota exhausted                    |
| 403    | Brand not a member, agent not published, or subdomain mismatch |
| 429    | Rate limit exceeded (see `Retry-After`)  |
| 502    | Upstream provider failed; retry shortly  |
| 503    | External API / Supabase not configured   |

## Examples

### Server-to-server (curl)

```bash
curl -sS -X POST https://api.helio.ae/v1/image/generate \
  -H "X-API-Key: helio_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"user_request":"Glass tower at golden hour","brand":"Binghatti"}'
```

### Browser (Framer)

```ts
const session = await supabase.auth.getSession();
const r = await fetch("https://api.helio.ae/v1/image/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.data.session?.access_token}`,
  },
  body: JSON.stringify({
    user_request: "Penthouse interior at dusk with city light spill.",
    brand: "Binghatti",
  }),
});
const { image_url } = await r.json();
```
