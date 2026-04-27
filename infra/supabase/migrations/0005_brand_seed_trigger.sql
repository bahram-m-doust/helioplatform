-- Auto-seed brand_agents + brand_quotas rows on brand creation.
--
-- Without this trigger, ``brand_agents.config_json IS NULL`` on a freshly
-- created brand and ``get_brand_agent_config`` returns NULL, which the
-- agents translate to 403 ``agent_not_published``. Operators can still
-- toggle ``enabled`` and ``published_at`` from the admin UI, but the
-- baseline rows must exist so the UI has something to toggle.
--
-- Five rows per agent kind (image, video, storyteller, campaign,
-- soul-print). Quotas default to 0 = unlimited so the legacy demo
-- behaviour is preserved; operators tighten the budget via the admin
-- UI before publishing externally.

create or replace function public.seed_brand_defaults()
returns trigger
language plpgsql
as $$
begin
    insert into brand_agents (brand_id, agent_kind, enabled)
    select new.id, kind, false
    from unnest(array['image', 'video', 'storyteller', 'campaign', 'soul-print']::text[]) as kind
    on conflict do nothing;

    insert into brand_quotas (brand_id, agent_kind, monthly_budget_cents)
    select new.id, kind, 0
    from unnest(array['image', 'video', 'storyteller', 'campaign', 'soul-print']::text[]) as kind
    on conflict do nothing;

    return new;
end;
$$;

drop trigger if exists brands_seed_defaults on brands;
create trigger brands_seed_defaults
    after insert on brands
    for each row execute function public.seed_brand_defaults();

comment on function public.seed_brand_defaults() is
    'Auto-seed brand_agents + brand_quotas rows so every new brand has a complete config matrix from creation. Owned by service role; trigger fires for any insert path.';
