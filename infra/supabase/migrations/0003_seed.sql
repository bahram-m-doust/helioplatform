-- Helio Platform — initial seed data.
--
-- Three demo brands (binghatti, mansory, technogym) — the same names
-- used by the existing prompt files in agents/*/backend/app/prompts/.
-- Each brand gets a stable sentinel UUID so seeded subdomains map
-- predictably across environments.
--
-- We deliberately do NOT seed brand_member rows — the demo brands have
-- no owner until an admin assigns one via tenant-api. The
-- brand_subdomains rows ARE seeded so the routing layer can resolve a
-- subdomain even before any user is attached.
--
-- Note: ``brand_agents`` and ``brand_quotas`` are no longer seeded
-- here. Migration 0005 installs an AFTER INSERT trigger on ``brands``
-- that materialises one row per agent_kind for every brand
-- (idempotent). Adding rows here would be redundant and would risk
-- drift if the trigger ever changes the default config_json shape.

insert into brands (id, slug, display_name, status, owner_user_id)
select brand_id, brand_slug, brand_name, 'active', placeholder_owner
from (
    -- Use the first available auth.users row as a placeholder owner.
    -- In a fresh project there is no user yet, so the surrounding WHERE
    -- skips the insert; admin attaches a real owner via tenant-api
    -- after the first sign-in.
    select
        unnest(array[
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000003'
        ])::uuid as brand_id,
        unnest(array['binghatti', 'mansory', 'technogym']) as brand_slug,
        unnest(array['Binghatti (demo)', 'Mansory (demo)', 'Technogym (demo)']) as brand_name,
        (select id from auth.users limit 1) as placeholder_owner
) as seeds
where exists (select 1 from auth.users)
on conflict (slug) do nothing;

insert into brand_subdomains (brand_id, subdomain)
select brand_id, brand_slug
from (
    select
        unnest(array[
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000003'
        ])::uuid as brand_id,
        unnest(array['binghatti', 'mansory', 'technogym']) as brand_slug
) as seeds
where exists (select 1 from brands where id = seeds.brand_id)
on conflict do nothing;
