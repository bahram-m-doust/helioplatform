-- RLS for brand_quotas.
--
-- Members read (so the admin UI can show "X of $Y used this month").
-- Only owners can change the budget. ``used_cents`` and ``period_start``
-- are bumped by services/tenant-api with the service role; never by user
-- writes (and the admin UI does not expose them).

alter table brand_quotas enable row level security;

create policy "members can read brand_quotas for their brands"
on brand_quotas
for select
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_quotas.brand_id
          and m.user_id = auth.uid()
    )
);

create policy "owners can change the budget"
on brand_quotas
for all
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_quotas.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
)
with check (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_quotas.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);
