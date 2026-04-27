-- Helio Platform — initial seed data.
--
-- Creates one demo brand (``binghatti``) with one subdomain. Run only
-- on a fresh database; subsequent runs are no-ops via ON CONFLICT.
--
-- We deliberately do NOT seed a brand_member row here — the demo brand
-- has no owner until an admin assigns one via tenant-api. The
-- brand_subdomains row IS seeded so the routing layer can resolve the
-- subdomain even before any user is attached.

insert into brands (id, slug, display_name, status, owner_user_id)
select
    '00000000-0000-0000-0000-000000000001'::uuid,
    'binghatti',
    'Binghatti (demo)',
    'active',
    -- Use the first available auth.users row as a placeholder owner; in
    -- a fresh project this will be NULL → the insert is skipped via the
    -- WHERE clause. Replace via tenant-api once a real admin signs in.
    (select id from auth.users limit 1)
where exists (select 1 from auth.users)
  and not exists (select 1 from brands where slug = 'binghatti')
on conflict do nothing;

insert into brand_subdomains (brand_id, subdomain)
select '00000000-0000-0000-0000-000000000001'::uuid, 'binghatti'
where exists (select 1 from brands where id = '00000000-0000-0000-0000-000000000001'::uuid)
on conflict do nothing;

-- Per-agent default rows so the admin UI can immediately render an
-- "enable / publish" toggle for every agent kind.
insert into brand_agents (brand_id, agent_kind, enabled)
select '00000000-0000-0000-0000-000000000001'::uuid, kind, false
from unnest(array['image', 'video', 'storyteller', 'campaign', 'soul-print']::text[]) as kind
where exists (select 1 from brands where id = '00000000-0000-0000-0000-000000000001'::uuid)
on conflict do nothing;

insert into brand_quotas (brand_id, agent_kind, monthly_budget_cents)
select '00000000-0000-0000-0000-000000000001'::uuid, kind, 0
from unnest(array['image', 'video', 'storyteller', 'campaign', 'soul-print']::text[]) as kind
where exists (select 1 from brands where id = '00000000-0000-0000-0000-000000000001'::uuid)
on conflict do nothing;
