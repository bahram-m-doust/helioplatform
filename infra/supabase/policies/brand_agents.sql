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
