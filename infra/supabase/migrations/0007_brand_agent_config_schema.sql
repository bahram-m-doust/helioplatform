-- Helio Platform — typed shape for brand_agents.config_json.
--
-- ``config_json`` was a free-form jsonb in 0001_init.sql so the schema
-- could ship before the override surface was finalised. Phase 3.5
-- locks the shape down with a CHECK constraint backed by a Postgres
-- function. Mirror the same shape in
-- ``services/tenant-api/app/schemas.py::BrandAgentConfig`` so the
-- admin UI rejects malformed bodies before the DB ever sees them.
--
-- Canonical shape (all keys optional except restricted_topics which
-- defaults to []):
--
--   {
--     "system_prompt_override": string | null,   // raw replacement prompt
--     "tone":                   string | null,   // 'luxurious', 'athletic', ...
--     "language":               string | null,   // 'en', 'ar', 'fr', ...
--     "persona":                string | null,   // 'concierge', 'trainer', ...
--     "restricted_topics":      string[]         // 0..32 strings, never null
--   }

create or replace function public.validate_brand_agent_config(p_config jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
    v_allowed_keys text[] := array[
        'system_prompt_override', 'tone', 'language', 'persona', 'restricted_topics'
    ];
    v_key text;
    v_topics jsonb;
    v_topic jsonb;
begin
    if p_config is null then
        return true;
    end if;
    if jsonb_typeof(p_config) <> 'object' then
        return false;
    end if;

    -- Reject unknown keys so the admin UI cannot accidentally store
    -- payload that callers down the line don't understand.
    for v_key in select * from jsonb_object_keys(p_config) loop
        if not (v_key = any(v_allowed_keys)) then
            return false;
        end if;
    end loop;

    -- Each scalar override must be a string when present.
    if (p_config ? 'system_prompt_override')
       and jsonb_typeof(p_config -> 'system_prompt_override') not in ('string', 'null') then
        return false;
    end if;
    if (p_config ? 'tone')
       and jsonb_typeof(p_config -> 'tone') not in ('string', 'null') then
        return false;
    end if;
    if (p_config ? 'language')
       and jsonb_typeof(p_config -> 'language') not in ('string', 'null') then
        return false;
    end if;
    if (p_config ? 'persona')
       and jsonb_typeof(p_config -> 'persona') not in ('string', 'null') then
        return false;
    end if;

    -- restricted_topics: array of strings, length 0..32.
    if p_config ? 'restricted_topics' then
        v_topics := p_config -> 'restricted_topics';
        if jsonb_typeof(v_topics) <> 'array' then
            return false;
        end if;
        if jsonb_array_length(v_topics) > 32 then
            return false;
        end if;
        for v_topic in select jsonb_array_elements(v_topics) loop
            if jsonb_typeof(v_topic) <> 'string' then
                return false;
            end if;
        end loop;
    end if;

    return true;
end;
$$;

comment on function public.validate_brand_agent_config(jsonb) is
    'IMMUTABLE. Returns true iff the payload matches the documented brand_agents.config_json schema. Used by the brand_agents_config_valid CHECK constraint.';

-- Drop any prior CHECK so re-running the migration is idempotent.
alter table public.brand_agents
    drop constraint if exists brand_agents_config_valid;

alter table public.brand_agents
    add constraint brand_agents_config_valid
    check (public.validate_brand_agent_config(config_json));

-- Seed example overrides for the three demo brands. Aligned with the
-- prompt files at ``agents/*/backend/app/prompts/`` (binghatti.txt,
-- mansory.txt, technogym.txt) so the per-brand override matches the
-- existing voice — operators can tweak without breaking continuity.
update public.brand_agents
set config_json = jsonb_build_object(
        'tone', 'luxurious',
        'language', 'en',
        'persona', 'architect',
        'restricted_topics', jsonb_build_array('politics', 'religion')
    ),
    updated_at = now()
where brand_id = '00000000-0000-0000-0000-000000000001'::uuid;

update public.brand_agents
set config_json = jsonb_build_object(
        'tone', 'bespoke-automotive',
        'language', 'en',
        'persona', 'concierge',
        'restricted_topics', jsonb_build_array('politics', 'religion', 'pricing')
    ),
    updated_at = now()
where brand_id = '00000000-0000-0000-0000-000000000002'::uuid;

update public.brand_agents
set config_json = jsonb_build_object(
        'tone', 'athletic',
        'language', 'en',
        'persona', 'trainer',
        'restricted_topics', jsonb_build_array('medical-advice', 'politics')
    ),
    updated_at = now()
where brand_id = '00000000-0000-0000-0000-000000000003'::uuid;
