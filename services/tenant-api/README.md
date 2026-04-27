# tenant-api

Multi-tenant control plane for Helio Platform. FastAPI service on port
**8060**, reachable through the edge nginx at
`https://api.helio.ae/api/tenant/`.

## Responsibilities

| Concern | Path |
|---|---|
| **Brand CRUD** (admin) | `POST /admin/brands`, `GET /admin/brands` |
| **API-key issuance** (admin) | `POST /admin/brands/{id}/api-keys` |
| **Subdomain routing** (admin) | `POST /admin/brands/{id}/subdomains` |
| **Caller's brands** (member) | `GET /me/brands` |
| **Health** | `GET /health` |

This service is the **only** place that holds
`SUPABASE_SERVICE_ROLE_KEY`. Agents never see it; they call Supabase
with the user's JWT (RLS-enforced) or with the anon key plus an
explicit `where brand_id = $1` filter on the API-key path.

## Auth model

Every non-health route requires a Supabase-issued JWT in
`Authorization: Bearer <token>`.

* **Member routes** (`/me/*`): forward the user's JWT to PostgREST so
  RLS scopes the query to the user's brands.
* **Admin routes** (`/admin/*`): require `app_metadata.role == 'helio_admin'`.
  Use the service role to bypass RLS — needed because brand creation,
  membership writes, and subdomain provisioning span tables a
  customer should never touch.

JWKS is fetched once and cached for an hour
(`packages/agent-common` does not own this — JWT verification lives in
this service so the service role concentration stays here).

## Configuration

Required env vars (see `.env.prod.example`):

```
SUPABASE_URL                   https://<project>.supabase.co
SUPABASE_ANON_KEY              <anon key from Supabase project settings>
SUPABASE_SERVICE_ROLE_KEY      <service-role key — keep ON THIS SERVICE ONLY>
SUPABASE_JWKS_URL              ${SUPABASE_URL}/auth/v1/.well-known/jwks.json
```

Optional CORS (only matters for browser callers; server-to-server is
unaffected):

```
TENANT_API_ALLOWED_ORIGINS=https://admin.helio.ae
TENANT_API_ALLOWED_ORIGIN_REGEX=^https://([a-z0-9-]+\.)?platform\.helio\.ae$
```

## Endpoints

### `GET /health`

Liveness probe. Returns `{ "status": "ok", "service": "tenant-api",
"supabase_configured": true }`. No auth.

### `GET /me/brands`

Returns the brands the caller belongs to.

```json
[
  { "brand_id": "...", "slug": "binghatti", "display_name": "Binghatti",
    "role": "owner" }
]
```

### `POST /admin/brands` *(admin)*

Create a brand. Body:

```json
{ "slug": "binghatti", "display_name": "Binghatti" }
```

The admin becomes the initial owner; an `owner` row is inserted into
`brand_members` in the same control-plane transaction.

### `POST /admin/brands/{id}/api-keys` *(admin)*

Issue a new server-to-server X-API-Key. The plaintext is returned
**exactly once**:

```json
{
  "id": "...", "brand_id": "...",
  "label": "framer-prod",
  "secret": "helio_live_…",
  "prefix": "helio_li",
  "created_at": "..."
}
```

Store the secret immediately; we keep only `sha256(secret)`.

### `POST /admin/brands/{id}/subdomains` *(admin)*

Record a Framer subdomain that's been provisioned manually in the Framer
UI. Body:

```json
{ "subdomain": "binghatti" }
```

This row populates `brand_subdomains`; agents read it for the JWT-vs-Origin
defense-in-depth check (see plan §B).

## Operations

### Apply schema migrations

```bash
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0002_rls.sql
psql "$SUPABASE_DB_URL" -f infra/supabase/migrations/0003_seed.sql
```

### Run RLS isolation tests

```bash
pg_prove --ext .sql infra/supabase/tests/
```

### Promote a user to `helio_admin`

In Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"helio_admin"'
)
where email = 'you@helio.ae';
```

The user's next-issued JWT carries `app_metadata.role = 'helio_admin'`.
