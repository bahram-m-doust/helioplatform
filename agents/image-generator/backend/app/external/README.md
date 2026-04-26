# Image-Generator — External API (`/v1`)

Public surface for third-party sites (Framer, custom landing pages, etc.).
Reachable through the edge nginx at `https://api.helio.ae/v1/image/...`.

The internal `/api/...` routes used by the main-app frontend are unchanged
and still live in `app/api/routes/image.py`.

## Authentication

Every request must include the header:

```
X-API-Key: <your-secret>
```

Keys are configured server-side via the `HELIO_EXTERNAL_API_KEYS_IMAGE`
environment variable (comma-separated `label:secret` pairs). Comparison
is constant-time. Missing or invalid keys return `401`.

## Rate limiting

Per-key token bucket. Default 30 req/min with a burst of 10. Exceeding
the limit returns `429` with a `Retry-After` header.

## CORS

Browser-side callers must come from an origin listed in
`HELIO_EXTERNAL_ALLOWED_ORIGINS`. Server-to-server callers ignore CORS.

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

### Error shape

All errors return `{"detail": "..."}` with a meaningful HTTP status:

| Status | Meaning                                  |
|-------:|------------------------------------------|
| 400    | Validation failed (see `detail`)         |
| 401    | Missing or invalid `X-API-Key`           |
| 429    | Rate limit exceeded (see `Retry-After`)  |
| 502    | Upstream provider failed; retry shortly  |
| 503    | External API not configured on server    |

## Example (Framer / fetch)

```ts
const r = await fetch("https://api.helio.ae/v1/image/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": import.meta.env.VITE_HELIO_KEY!,
  },
  body: JSON.stringify({
    user_request: "Penthouse interior at dusk with city light spill.",
    brand: "Binghatti",
  }),
});
const { image_url } = await r.json();
```
