# Video-Generator — External API (`/v1`)

Public surface for third-party sites. Reachable through the edge nginx
at `https://api.helio.ae/v1/video/...`. Internal `/api/...` routes
used by the admin app stay in `app/api/routes/video.py`.

## Authentication

Same two-path model as the rest of the agents:

  - **Supabase JWT** in `Authorization: Bearer …` (browser callers from
    `*.platform.helio.ae`). The agent verifies against
    `SUPABASE_JWKS_URL`, reads `app_metadata.brand_id`, confirms
    membership, and cross-checks the `Origin` subdomain.
  - **Per-brand `X-API-Key`** (server-to-server). SHA-256 hash looked
    up in `brand_api_keys`; per-key token bucket applied.

Legacy mode (no `SUPABASE_URL`): X-API-Key validates against
`HELIO_EXTERNAL_API_KEYS_VIDEO`; JWT path returns `503`.

## Per-brand behaviour

`brand_agents.config_json.system_prompt_override` (typed shape from
migration 0007) replaces the static Kling system prompt for the brand.
Disabled / unpublished brands return `403 agent_not_published`.

## Quota

Cost: **60 cents/run** by default (video renders are expensive).
Debited atomically via `consume_brand_quota` before invoking Replicate.
Returns `402` on exhaustion.

## Rate limiting

Tighter defaults than the image agent: **10 r/m, burst 4** per key.
Override via `HELIO_EXTERNAL_VIDEO_RATE_PER_MINUTE` /
`HELIO_EXTERNAL_VIDEO_RATE_BURST`. nginx adds an IP-keyed 60 r/m layer.

## CORS

Same `HELIO_EXTERNAL_ALLOWED_ORIGINS` / `_ORIGIN_REGEX` as every
agent. Server-to-server ignores CORS.

## Endpoint

### `POST /v1/generate`

Image-to-video. Caller supplies a still image URL + a motion
description; agent generates a Kling motion prompt, runs the Replicate
prediction, and returns the video URL.

Request:

```json
{
  "user_request": "A slow cinematic push-in toward the tower while clouds drift past.",
  "image_url": "https://example.com/keyframe.jpg",
  "brand": "Binghatti",
  "duration": 5
}
```

`duration` is bounded by `HELIO_EXTERNAL_MIN_DURATION` /
`HELIO_EXTERNAL_MAX_DURATION` (defaults: 1–10 seconds).

Response:

```json
{
  "status": "succeeded",
  "video_url": "https://replicate.delivery/.../out.mp4",
  "prompt": "Subtle parallax push-in ...",
  "brand": "Binghatti",
  "duration": 5
}
```

## Audit

Each call appends one `agent_runs` row (status, cost, duration,
error_code). Visible in the admin app's `/runs` and rolled up by month
at `/usage`.

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
