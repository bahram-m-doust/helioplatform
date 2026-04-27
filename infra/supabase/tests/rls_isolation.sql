-- pgTAP: cross-tenant RLS isolation regression.
--
-- Sets up two synthetic brands (A, B) and two synthetic users (one per
-- brand). Switches into each user's auth context and asserts that the
-- "other" brand's rows are invisible across every tenant-scoped table.
--
-- Wraps everything in BEGIN / ROLLBACK so the database is unchanged.

begin;

select plan(14);

-- =========================================================================
-- Setup: two brands, two users, two membership rows.
-- =========================================================================
insert into auth.users (id, instance_id, email, aud, role)
values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'a@test', 'authenticated', 'authenticated'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'b@test', 'authenticated', 'authenticated');

insert into brands (id, slug, display_name, owner_user_id) values
    ('aa000000-0000-0000-0000-000000000000', 'brand-a', 'Brand A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ('bb000000-0000-0000-0000-000000000000', 'brand-b', 'Brand B', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

insert into brand_members (brand_id, user_id, role) values
    ('aa000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
    ('bb000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

insert into brand_agents (brand_id, agent_kind, enabled) values
    ('aa000000-0000-0000-0000-000000000000', 'image', true),
    ('bb000000-0000-0000-0000-000000000000', 'image', true);

insert into brand_quotas (brand_id, agent_kind, monthly_budget_cents) values
    ('aa000000-0000-0000-0000-000000000000', 'image', 1000),
    ('bb000000-0000-0000-0000-000000000000', 'image', 2000);

-- agent_runs: write as service role (bypasses RLS).
insert into agent_runs (brand_id, agent_kind, status, request_payload) values
    ('aa000000-0000-0000-0000-000000000000', 'image', 'succeeded', '{"u":"a"}'::jsonb),
    ('bb000000-0000-0000-0000-000000000000', 'image', 'succeeded', '{"u":"b"}'::jsonb);

-- =========================================================================
-- Switch to user A's auth context.
-- =========================================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

select results_eq(
    $$ select count(*)::int from brands $$,
    array[1],
    'user A sees exactly 1 brand (their own)'
);

select results_eq(
    $$ select slug::text from brands $$,
    array['brand-a'],
    'user A sees brand-a only, not brand-b'
);

select results_eq(
    $$ select count(*)::int from brand_members $$,
    array[1],
    'user A sees exactly 1 membership row'
);

select results_eq(
    $$ select count(*)::int from brand_agents $$,
    array[1],
    'user A sees exactly 1 brand_agents row'
);

select results_eq(
    $$ select count(*)::int from brand_quotas $$,
    array[1],
    'user A sees exactly 1 brand_quotas row'
);

select results_eq(
    $$ select count(*)::int from agent_runs $$,
    array[1],
    'user A sees exactly 1 agent_runs row'
);

select throws_ok(
    $$ insert into brand_agents (brand_id, agent_kind, enabled)
       values ('bb000000-0000-0000-0000-000000000000', 'video', true) $$,
    'new row violates row-level security policy for table "brand_agents"',
    'user A cannot write into brand-b agent config'
);

-- =========================================================================
-- Switch to user B's auth context.
-- =========================================================================
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

select results_eq(
    $$ select count(*)::int from brands $$,
    array[1],
    'user B sees exactly 1 brand'
);

select results_eq(
    $$ select slug::text from brands $$,
    array['brand-b'],
    'user B sees brand-b only, not brand-a'
);

select results_eq(
    $$ select count(*)::int from agent_runs $$,
    array[1],
    'user B sees exactly 1 agent_runs row'
);

-- =========================================================================
-- brand_subdomains is read-public (routing table). Confirm READ works
-- for both users, but WRITE is blocked unless caller is helio_admin.
-- =========================================================================
insert into brand_subdomains (brand_id, subdomain) values
    ('aa000000-0000-0000-0000-000000000000', 'brand-a'),
    ('bb000000-0000-0000-0000-000000000000', 'brand-b');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select results_eq(
    $$ select count(*)::int from brand_subdomains $$,
    array[2],
    'brand_subdomains is readable by every user (routing table)'
);

select throws_ok(
    $$ insert into brand_subdomains (brand_id, subdomain)
       values ('aa000000-0000-0000-0000-000000000000', 'malicious') $$,
    'new row violates row-level security policy for table "brand_subdomains"',
    'non-admin user cannot insert subdomains'
);

-- Promote user A to helio_admin via JWT claim and confirm the write succeeds.
select set_config(
    'request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","app_metadata":{"role":"helio_admin"}}',
    true
);

select lives_ok(
    $$ insert into brand_subdomains (brand_id, subdomain)
       values ('aa000000-0000-0000-0000-000000000000', 'brand-a-extra') $$,
    'helio_admin can insert subdomains'
);

select results_eq(
    $$ select count(*)::int from brand_subdomains $$,
    array[3],
    'helio_admin sees the new row'
);

select * from finish();
rollback;
