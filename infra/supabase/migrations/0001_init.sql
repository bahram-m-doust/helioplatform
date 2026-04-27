-- Helio Platform — Supabase initial schema (multi-tenant control plane).
--
-- Tables:
--   brands              — one row per customer brand (tenant)
--   brand_members       — many-to-many between auth.users and brands
--   brand_api_keys      — server-to-server keys, one or more per brand
--   brand_subdomains    — Framer subdomains routing to a brand (manual provisioning)
--   brand_agents        — per-brand enable + per-brand prompt overrides
--   brand_quotas        — monthly spend caps per (brand, agent_kind)
--   agent_runs          — audit + analytics, one row per /v1 call
--
-- Conventions:
--   * UUID primary keys via gen_random_uuid()
--   * timestamptz with default now()
--   * citext for case-insensitive uniqueness on slugs/subdomains
--   * RLS enabled in 0002_rls.sql; this file only declares structure
--   * service_role bypasses RLS — only services/tenant-api uses it

create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- case-insensitive text

-- =========================================================================
-- brands — the tenant root
-- =========================================================================
create table brands (
    id              uuid        primary key default gen_random_uuid(),
    slug            citext      not null unique,
    display_name    text        not null,
    status          text        not null default 'active'
                                check (status in ('active', 'suspended', 'archived')),
    owner_user_id   uuid        not null references auth.users(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table  brands              is 'One row per customer brand. The tenant root.';
comment on column brands.slug         is 'URL-safe identifier (e.g. ''binghatti''). Used in subdomains.';
comment on column brands.owner_user_id is 'Initial creator. Removed members keep the brand alive via brand_members.';

-- =========================================================================
-- brand_members — many-to-many user <-> brand with role
-- =========================================================================
create table brand_members (
    brand_id    uuid        not null references brands(id) on delete cascade,
    user_id     uuid        not null references auth.users(id) on delete cascade,
    role        text        not null default 'editor'
                            check (role in ('owner', 'editor', 'viewer')),
    invited_at  timestamptz not null default now(),
    primary key (brand_id, user_id)
);

create index brand_members_user_idx on brand_members (user_id);

comment on table brand_members is 'Authorisation: which users can act on which brand.';

-- =========================================================================
-- brand_api_keys — server-to-server credentials (Framer / partners)
-- =========================================================================
create table brand_api_keys (
    id            uuid        primary key default gen_random_uuid(),
    brand_id      uuid        not null references brands(id) on delete cascade,
    label         text        not null,
    -- We store SHA-256(secret) only; the plaintext is shown once at issuance.
    key_hash      bytea       not null unique,
    -- First 8 chars of the plaintext, displayed in admin UI for identification.
    prefix        text        not null,
    created_by    uuid        references auth.users(id),
    created_at    timestamptz not null default now(),
    revoked_at    timestamptz,
    last_used_at  timestamptz
);

create index brand_api_keys_brand_idx on brand_api_keys (brand_id);
create index brand_api_keys_active_idx on brand_api_keys (brand_id) where revoked_at is null;

comment on table  brand_api_keys           is 'Per-brand X-API-Key credentials. Hashed; plaintext shown once.';
comment on column brand_api_keys.key_hash  is 'SHA-256 of the secret. Compared with constant-time digest.';
comment on column brand_api_keys.prefix    is 'First 8 plaintext chars; identification only, not authentication.';

-- =========================================================================
-- brand_subdomains — Framer subdomain -> brand routing table
-- =========================================================================
create table brand_subdomains (
    brand_id   uuid    primary key references brands(id) on delete cascade,
    subdomain  citext  not null unique,
    created_at timestamptz not null default now()
);

comment on table  brand_subdomains          is 'Manual mapping from Framer subdomain to brand. Used as defense-in-depth cross-check against the JWT.';
comment on column brand_subdomains.subdomain is 'Just the leftmost label, e.g. ''binghatti'' for binghatti.platform.helio.ae.';

-- =========================================================================
-- brand_agents — per-brand enable + per-brand prompt overrides
-- =========================================================================
create table brand_agents (
    brand_id      uuid        not null references brands(id) on delete cascade,
    agent_kind    text        not null
                              check (agent_kind in ('image', 'video', 'storyteller', 'campaign', 'soul-print')),
    enabled       boolean     not null default false,
    config_json   jsonb       not null default '{}'::jsonb,
    published_at  timestamptz,
    updated_at    timestamptz not null default now(),
    primary key (brand_id, agent_kind)
);

comment on table  brand_agents             is 'Per-brand enable flag + per-brand prompt overrides + publish gate.';
comment on column brand_agents.config_json is 'Free-form per-brand config. Conventional keys: system_prompt_override, model, temperature.';
comment on column brand_agents.published_at is 'NULL until admin clicks ''Publish''. Customer-facing /v1 routes refuse non-published agents.';

-- =========================================================================
-- brand_quotas — monthly spend cap per (brand, agent)
-- =========================================================================
create table brand_quotas (
    brand_id              uuid    not null references brands(id) on delete cascade,
    agent_kind            text    not null
                                  check (agent_kind in ('image', 'video', 'storyteller', 'campaign', 'soul-print')),
    monthly_budget_cents  integer not null default 0 check (monthly_budget_cents >= 0),
    used_cents            integer not null default 0 check (used_cents >= 0),
    period_start          date    not null default date_trunc('month', now())::date,
    primary key (brand_id, agent_kind)
);

comment on column brand_quotas.monthly_budget_cents is '0 = unlimited. Otherwise hard cap; agent returns 402 once used >= budget.';
comment on column brand_quotas.period_start         is 'First day of the current accounting month. Reset by a daily job.';

-- =========================================================================
-- agent_runs — append-only audit + analytics
-- =========================================================================
create table agent_runs (
    id                uuid        primary key default gen_random_uuid(),
    brand_id          uuid        not null references brands(id) on delete cascade,
    user_id           uuid        references auth.users(id),
    api_key_id        uuid        references brand_api_keys(id) on delete set null,
    agent_kind        text        not null
                                  check (agent_kind in ('image', 'video', 'storyteller', 'campaign', 'soul-print')),
    status            text        not null
                                  check (status in ('queued', 'running', 'succeeded', 'failed')),
    request_payload   jsonb       not null,
    response_payload  jsonb,
    cost_usd          numeric(10, 4),
    duration_ms       integer,
    error_code        text,
    created_at        timestamptz not null default now()
);

create index agent_runs_brand_created_idx on agent_runs (brand_id, created_at desc);
create index agent_runs_status_active_idx on agent_runs (status) where status in ('queued', 'running');

comment on table  agent_runs           is 'Append-only audit log. One row per /v1 call (success and failure).';
comment on column agent_runs.user_id   is 'NULL for X-API-Key callers; use api_key_id for those.';
comment on column agent_runs.cost_usd  is 'Estimated cost in USD; populated once the upstream provider returns billing info.';

-- =========================================================================
-- updated_at triggers — auto-refresh on UPDATE
-- =========================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger brands_set_updated_at
    before update on brands
    for each row execute function set_updated_at();

create trigger brand_agents_set_updated_at
    before update on brand_agents
    for each row execute function set_updated_at();
