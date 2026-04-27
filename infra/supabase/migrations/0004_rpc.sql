-- Helio Platform — RPC functions for the agent-side tenant resolver.
--
-- Agents never hold the service-role key, but they need three operations
-- that bypass RLS: (a) resolve an X-API-Key hash to a brand_id; (b)
-- atomically consume a brand's quota; (c) append an audit row to
-- agent_runs. We expose each as a Postgres SECURITY DEFINER function so
-- the function runs with the function-owner's privileges (service role)
-- while the calling role (anon) doesn't gain any new privileges.
--
-- Each function is narrowly scoped: it does ONE thing and accepts only
-- the parameters needed for that thing. The caller cannot pass arbitrary
-- SQL; the function body is the entire attack surface.
--
-- Convention: all RPCs return SETOF (jsonb-friendly composite); empty
-- result = "not found" / "denied".

-- =========================================================================
-- resolve_brand_api_key(key_hash_hex text)
-- Look up an unrevoked API key by SHA-256 hex hash.
-- Returns (brand_id, brand_slug, api_key_id) or empty.
-- Bumps last_used_at as a side-effect (best-effort observability).
-- =========================================================================
create or replace function public.resolve_brand_api_key(key_hash_hex text)
returns table (
    brand_id    uuid,
    brand_slug  text,
    api_key_id  uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_hash bytea := decode(key_hash_hex, 'hex');
begin
    return query
    update brand_api_keys k
    set last_used_at = now()
    from brands b
    where k.key_hash = v_hash
      and k.revoked_at is null
      and b.id = k.brand_id
    returning k.brand_id, b.slug::text, k.id;
end;
$$;

revoke all on function public.resolve_brand_api_key(text) from public;
grant execute on function public.resolve_brand_api_key(text) to anon, authenticated;

comment on function public.resolve_brand_api_key(text) is
    'SECURITY DEFINER. Resolve an unrevoked X-API-Key to its brand. Used by agents on the X-API-Key auth path.';

-- =========================================================================
-- consume_brand_quota(brand_id uuid, agent_kind text, cost_cents int)
-- Atomically increment used_cents and check against the budget.
-- Returns true if the quota allowed the spend; false if blocked.
-- The budget=0 sentinel means unlimited.
-- =========================================================================
create or replace function public.consume_brand_quota(
    p_brand_id uuid,
    p_agent_kind text,
    p_cost_cents integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_budget integer;
    v_used   integer;
begin
    if p_cost_cents < 0 then
        raise exception 'cost_cents must be non-negative';
    end if;

    select monthly_budget_cents, used_cents
    into v_budget, v_used
    from brand_quotas
    where brand_id = p_brand_id
      and agent_kind = p_agent_kind
    for update;

    if not found then
        return false;  -- no quota row = explicitly disabled
    end if;

    if v_budget = 0 then
        update brand_quotas
        set used_cents = used_cents + p_cost_cents
        where brand_id = p_brand_id and agent_kind = p_agent_kind;
        return true;
    end if;

    if v_used + p_cost_cents > v_budget then
        return false;
    end if;

    update brand_quotas
    set used_cents = used_cents + p_cost_cents
    where brand_id = p_brand_id and agent_kind = p_agent_kind;
    return true;
end;
$$;

revoke all on function public.consume_brand_quota(uuid, text, integer) from public;
grant execute on function public.consume_brand_quota(uuid, text, integer) to anon, authenticated;

comment on function public.consume_brand_quota(uuid, text, integer) is
    'SECURITY DEFINER. Atomically increment brand_quotas.used_cents and gate against monthly_budget_cents. Returns true if allowed.';

-- =========================================================================
-- record_agent_run(...) — append-only audit write.
-- Returns the new agent_runs.id.
-- =========================================================================
create or replace function public.record_agent_run(
    p_brand_id uuid,
    p_user_id uuid,
    p_api_key_id uuid,
    p_agent_kind text,
    p_status text,
    p_request_payload jsonb,
    p_response_payload jsonb,
    p_cost_usd numeric,
    p_duration_ms integer,
    p_error_code text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_id uuid;
begin
    insert into agent_runs (
        brand_id, user_id, api_key_id, agent_kind, status,
        request_payload, response_payload, cost_usd, duration_ms, error_code
    ) values (
        p_brand_id, p_user_id, p_api_key_id, p_agent_kind, p_status,
        coalesce(p_request_payload, '{}'::jsonb),
        p_response_payload, p_cost_usd, p_duration_ms, p_error_code
    )
    returning id into v_id;
    return v_id;
end;
$$;

revoke all on function public.record_agent_run(
    uuid, uuid, uuid, text, text, jsonb, jsonb, numeric, integer, text
) from public;
grant execute on function public.record_agent_run(
    uuid, uuid, uuid, text, text, jsonb, jsonb, numeric, integer, text
) to anon, authenticated;

comment on function public.record_agent_run(
    uuid, uuid, uuid, text, text, jsonb, jsonb, numeric, integer, text
) is
    'SECURITY DEFINER. Append a single agent_runs row. Used by every agent /v1 handler.';

-- =========================================================================
-- get_brand_agent_config(brand_id uuid, agent_kind text)
-- Read the per-brand override for one agent. Returns the config_json
-- when the agent is enabled+published, else NULL — agents short-circuit
-- to 403 on NULL.
-- =========================================================================
create or replace function public.get_brand_agent_config(
    p_brand_id uuid,
    p_agent_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_config jsonb;
begin
    select config_json
    into v_config
    from brand_agents
    where brand_id = p_brand_id
      and agent_kind = p_agent_kind
      and enabled = true
      and published_at is not null;
    return v_config;
end;
$$;

revoke all on function public.get_brand_agent_config(uuid, text) from public;
grant execute on function public.get_brand_agent_config(uuid, text) to anon, authenticated;

comment on function public.get_brand_agent_config(uuid, text) is
    'SECURITY DEFINER. Return the published config_json for one (brand, agent) pair, or NULL.';
