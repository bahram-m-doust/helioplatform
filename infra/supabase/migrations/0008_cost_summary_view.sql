-- Helio Platform — per-brand cost summary view.
--
-- Aggregates ``agent_runs.cost_usd`` by (brand_id, agent_kind, month)
-- so the admin UI's Usage page can render a per-brand breakdown
-- without re-summing on every request. The user explicitly asked for
-- "API per brand to measure each person's cost" — this view is what
-- the /me/usage endpoint reads.
--
-- The view inherits the RLS posture of agent_runs: only members of a
-- brand can read its rows. We can't put RLS on a view directly, so the
-- view is created with ``security_invoker = true`` (Postgres 15+, the
-- Supabase default) which means SELECTs run with the caller's
-- privileges, not the view owner's.

create or replace view public.brand_cost_summary
with (security_invoker = true)
as
select
    brand_id,
    agent_kind,
    date_trunc('month', created_at)::date as period_start,
    count(*) filter (where status = 'succeeded')                                  as succeeded_count,
    count(*) filter (where status = 'failed')                                     as failed_count,
    coalesce(sum(cost_usd) filter (where status = 'succeeded'), 0)::numeric(12,4) as total_cost_usd,
    coalesce(avg(duration_ms) filter (where status = 'succeeded'), 0)::integer    as avg_duration_ms,
    max(created_at)                                                               as last_run_at
from public.agent_runs
group by brand_id, agent_kind, date_trunc('month', created_at);

comment on view public.brand_cost_summary is
    'Per-(brand, agent_kind, month) aggregation of agent_runs. RLS is inherited from agent_runs via security_invoker=true.';

-- Grant SELECT explicitly so authenticated callers can hit the view
-- through PostgREST. (Service role bypasses GRANT anyway.)
grant select on public.brand_cost_summary to authenticated;
