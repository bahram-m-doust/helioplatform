-- Helio Platform — auth.users -> brand_members link on signup.
--
-- When a new user signs up via Supabase Auth (`supabase.auth.signUp`),
-- the Framer signup form is expected to pass:
--
--   { options: { data: { brand_code: 'binghatti' } } }
--
-- which Supabase stores in ``auth.users.raw_user_meta_data->>'brand_code'``.
-- This trigger reads it, resolves to a brand_id, inserts a
-- ``brand_members`` row, and stamps ``raw_app_meta_data.brand_id`` so the
-- FIRST JWT the user receives already carries the tenant claim — no
-- second sign-in is needed before the agent flows work.
--
-- Security model:
--   - ``raw_user_meta_data``  is user-controlled; we treat its values as
--     untrusted input and only LOOK UP an existing brand by slug.
--   - ``raw_app_meta_data``   is service-role-only; we write to it from
--     this trigger function (SECURITY DEFINER, owned by service role).
--
-- Failure modes:
--   - brand_code missing      → silently no-op (orphan user; admin
--                               attaches via tenant-api later).
--   - brand_code invalid      → silently no-op (avoid leaking which
--                               slugs exist via signup error messages).
--   - duplicate membership    → no-op via ON CONFLICT.

create or replace function public.link_user_to_brand_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_brand_code text;
    v_brand_id   uuid;
begin
    v_brand_code := lower(coalesce(new.raw_user_meta_data ->> 'brand_code', ''));
    if v_brand_code = '' then
        return new;
    end if;

    select id into v_brand_id
    from public.brands
    where slug = v_brand_code
    limit 1;

    if v_brand_id is null then
        return new;
    end if;

    -- Membership row. ON CONFLICT keeps the trigger idempotent if it
    -- ever fires twice (e.g. Supabase Auth replay).
    insert into public.brand_members (brand_id, user_id, role)
    values (v_brand_id, new.id, 'editor')
    on conflict (brand_id, user_id) do nothing;

    -- Stamp the tenant claim into app_metadata. We merge with whatever
    -- might already be there (e.g. role claims set by a separate
    -- promotion flow) instead of overwriting.
    update auth.users
    set raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{brand_id}',
        to_jsonb(v_brand_id::text)
    )
    where id = new.id;

    return new;
end;
$$;

revoke all on function public.link_user_to_brand_on_signup() from public;

drop trigger if exists link_user_to_brand_on_signup on auth.users;
create trigger link_user_to_brand_on_signup
    after insert on auth.users
    for each row execute function public.link_user_to_brand_on_signup();

comment on function public.link_user_to_brand_on_signup() is
    'SECURITY DEFINER. Read raw_user_meta_data.brand_code, attach the user to the brand via brand_members, and stamp app_metadata.brand_id so the first JWT carries the tenant claim. No-op when brand_code is missing or invalid.';
