-- Helio Platform — Row-level security policies.
--
-- This migration is **self-contained**: every CREATE POLICY statement is
-- inlined below so any tool that can run plain SQL (psql, Supabase CLI,
-- sqlx-cli, raw libpq) can apply it. The per-table source files in
-- `infra/supabase/policies/*.sql` remain the canonical reference for
-- code review (one file per table); CI MUST keep them byte-identical
-- with the inlined block here.
--
-- IMPORTANT: every tenant-scoped table has RLS enabled. The service
-- role (``SUPABASE_SERVICE_ROLE_KEY``) bypasses RLS entirely; that key
-- lives ONLY in services/tenant-api. Agents never see it; they call
-- Supabase with the user's JWT (browser path) or do explicit
-- ``where brand_id = $1`` filtering (X-API-Key path).

-- =========================================================================
-- infra/supabase/policies/brands.sql
-- =========================================================================
-- RLS for brands.
--
-- Members read; only owners can update/delete; only authenticated users
-- can insert (and the trigger sets owner_user_id = auth.uid() so they
-- become the owner). Service role (used by services/tenant-api) bypasses
-- RLS entirely.

alter table brands enable row level security;

-- READ: any user who is a member of the brand can see it.
create policy "members can read their brands"
on brands
for select
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brands.id
          and m.user_id = auth.uid()
    )
    or owner_user_id = auth.uid()
);

-- INSERT: any authenticated user can create a brand. The brand becomes
-- "owned" by them via owner_user_id; the matching brand_members row is
-- inserted by services/tenant-api inside the same transaction.
create policy "any authenticated user can create a brand"
on brands
for insert
to authenticated
with check (owner_user_id = auth.uid());

-- UPDATE / DELETE: only members with role='owner' may mutate the brand row.
create policy "owners can update their brand"
on brands
for update
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brands.id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
)
with check (
    exists (
        select 1 from brand_members m
        where m.brand_id = brands.id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);

create policy "owners can delete their brand"
on brands
for delete
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brands.id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);

-- =========================================================================
-- infra/supabase/policies/brand_members.sql
-- =========================================================================
-- RLS for brand_members.
--
-- A user can read the membership rows for any brand they belong to (so
-- the admin UI can list co-members). Only owners can insert/update/delete
-- membership rows.

alter table brand_members enable row level security;

create policy "members can read membership of their brands"
on brand_members
for select
to authenticated
using (
    exists (
        select 1 from brand_members self
        where self.brand_id = brand_members.brand_id
          and self.user_id = auth.uid()
    )
);

create policy "owners can manage membership"
on brand_members
for all
to authenticated
using (
    exists (
        select 1 from brand_members owner_row
        where owner_row.brand_id = brand_members.brand_id
          and owner_row.user_id = auth.uid()
          and owner_row.role = 'owner'
    )
)
with check (
    exists (
        select 1 from brand_members owner_row
        where owner_row.brand_id = brand_members.brand_id
          and owner_row.user_id = auth.uid()
          and owner_row.role = 'owner'
    )
);

-- =========================================================================
-- infra/supabase/policies/brand_api_keys.sql
-- =========================================================================
-- RLS for brand_api_keys.
--
-- Members can READ key metadata (label, prefix, last_used_at, revoked_at)
-- — never the hash itself, since `bytea` is selected by every client.
-- Owners can INSERT (issue) and UPDATE (revoke) keys. DELETE is forbidden
-- via RLS so revocation is a soft delete (revoked_at) and the audit
-- trail in agent_runs.api_key_id stays intact.

alter table brand_api_keys enable row level security;

create policy "members can read key metadata for their brands"
on brand_api_keys
for select
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_api_keys.brand_id
          and m.user_id = auth.uid()
    )
);

create policy "owners can issue keys"
on brand_api_keys
for insert
to authenticated
with check (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_api_keys.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);

create policy "owners can revoke keys"
on brand_api_keys
for update
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_api_keys.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
)
with check (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_api_keys.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);

-- =========================================================================
-- infra/supabase/policies/brand_subdomains.sql
-- =========================================================================
-- RLS for brand_subdomains.
--
-- This is a routing table; the agents need to read it to resolve
-- ``binghatti.platform.helio.ae -> brand_id``. Therefore READ is open to
-- everyone (including the anon key). WRITE is restricted to admins (the
-- ``helio_admin`` role claim) — Framer subdomain provisioning is an
-- internal operation, never customer-driven.

alter table brand_subdomains enable row level security;

create policy "anyone can read brand subdomains"
on brand_subdomains
for select
using (true);

create policy "admins can manage brand subdomains"
on brand_subdomains
for all
to authenticated
using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'helio_admin'
)
with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'helio_admin'
);

-- =========================================================================
-- infra/supabase/policies/brand_agents.sql
-- =========================================================================
-- RLS for brand_agents.
--
-- Members read; only owners and editors write. Publishing (setting
-- published_at) is intentionally allowed to editors so the agent author
-- can ship without needing the owner.

alter table brand_agents enable row level security;

create policy "members can read brand_agents for their brands"
on brand_agents
for select
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_agents.brand_id
          and m.user_id = auth.uid()
    )
);

create policy "owners and editors can write brand_agents"
on brand_agents
for all
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_agents.brand_id
          and m.user_id = auth.uid()
          and m.role in ('owner', 'editor')
    )
)
with check (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_agents.brand_id
          and m.user_id = auth.uid()
          and m.role in ('owner', 'editor')
    )
);

-- =========================================================================
-- infra/supabase/policies/brand_quotas.sql
-- =========================================================================
-- RLS for brand_quotas.
--
-- Members read (so the admin UI can show "X of $Y used this month").
-- Only owners can change the budget. ``used_cents`` and ``period_start``
-- are bumped by services/tenant-api with the service role; never by user
-- writes (and the admin UI does not expose them).

alter table brand_quotas enable row level security;

create policy "members can read brand_quotas for their brands"
on brand_quotas
for select
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_quotas.brand_id
          and m.user_id = auth.uid()
    )
);

create policy "owners can change the budget"
on brand_quotas
for all
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_quotas.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
)
with check (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_quotas.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);

-- =========================================================================
-- infra/supabase/policies/agent_runs.sql
-- =========================================================================
-- RLS for agent_runs.
--
-- Read-only for members. INSERT is restricted to the service role —
-- agents do not write through Supabase auth; tenant-api / agents call
-- with the service role key for audit writes (and explicitly filter
-- ``brand_id`` in the INSERT). UPDATE / DELETE are forbidden because
-- this table is meant to be append-only audit log.

alter table agent_runs enable row level security;

create policy "members can read agent_runs for their brands"
on agent_runs
for select
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = agent_runs.brand_id
          and m.user_id = auth.uid()
    )
);

-- No INSERT / UPDATE / DELETE policies for the ``authenticated`` role:
-- only the service role (which bypasses RLS) may write to this table.

