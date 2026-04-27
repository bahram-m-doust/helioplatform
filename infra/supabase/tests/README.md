# Supabase RLS regression tests

These tests prove **cross-tenant isolation**: a user in brand A must
never see, modify, or delete brand B's rows. RLS misconfiguration is the
single most catastrophic failure mode of this architecture; every PR
that touches schema or policies MUST keep these tests green.

## Running

Requires `pgTAP` installed in the target database:

```sql
create extension if not exists pgtap;
```

Then run any test file with the `pg_prove` CLI (from
[`pgTAP`](https://pgtap.org/)):

```bash
pg_prove --ext .sql infra/supabase/tests/
```

Or via `psql`:

```bash
psql "$DATABASE_URL" -f infra/supabase/tests/rls_isolation.sql
```

## Test structure

Each test file:

1. Sets up two synthetic brands + two synthetic users (one per brand)
   inside a `BEGIN` / `ROLLBACK` block so it never pollutes the database.
2. Switches the runtime auth context to user A via `set_config()` of
   `request.jwt.claim.sub`.
3. Asserts that queries return ONLY user A's rows.
4. Switches to user B and re-asserts.
