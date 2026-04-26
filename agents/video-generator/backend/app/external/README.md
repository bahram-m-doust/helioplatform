# Video-Generator — External API (`/v1`)

Public surface for third-party sites (Framer etc.). Reachable through the
edge nginx at `https://api.helio.ae/v1/video/...`. Internal `/api/...`
routes used by the main-app frontend stay in `app/api/routes/video.py`.

## Authentication

```
X-API-Key: <your-secret>
```

Configured via `HELIO_EXTERNAL_API_KEYS_VIDEO` (comma-separated
`label:secret` pairs, constant-time compared).

## Rate limiting

Per-key token bucket. Default 10 req/min, burst 4. (Video renders are
expensive — keep the limits tighter than the image agent.) Exceeding the
limit returns `429` with `Retry-After`.

## CORS

Browser callers must come from an origin in
`HELIO_EXTERNAL_ALLOWED_ORIGINS`.

## Endpoint

### `POST /v1/generate`

```json
{
  "user_request": "A slow push-in toward the tower while clouds drift past.",
  "image_url": "https://example.com/keyframe.jpg",
  "brand": "Binghatti",
  "duration": 5
}
```

```json
{
  "status": "succeeded",
  "video_url": "https://replicate.delivery/.../out.mp4",
  "prompt": "Subtle parallax push-in ...",
  "brand": "Binghatti",
  "duration": 5
}
```

`duration` is bounded by `HELIO_EXTERNAL_MIN_DURATION` /
`HELIO_EXTERNAL_MAX_DURATION` (defaults: 1–10 seconds).

## Errors

| Status | Meaning                                  |
|-------:|------------------------------------------|
| 400    | Validation failed                        |
| 401    | Missing or invalid `X-API-Key`           |
| 429    | Rate limit exceeded                      |
| 502    | Upstream provider failed                 |
| 503    | External API not configured on server    |
