-- RLS for brand_api_keys.
--
-- Members can READ key metadata (label, prefix, last_used_at, revoked_at)
-- — never the hash itself, since `bytea` is selected by every client.
-- Owners can INSERT (issue) and UPDATE (revoke) keys. DELETE is forbidden
-- via RLS so revocation is a soft delete (revoked_at) and the audit
-- trail in agent_runs.api_key_id stays intact.

alter table brand_api_keys enable row level security;

create policy "members can read key metadata for their brands"
on brand_api_keys
for select
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_api_keys.brand_id
          and m.user_id = auth.uid()
    )
);

create policy "owners can issue keys"
on brand_api_keys
for insert
to authenticated
with check (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_api_keys.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);

create policy "owners can revoke keys"
on brand_api_keys
for update
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_api_keys.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
)
with check (
    exists (
        select 1 from brand_members m
        where m.brand_id = brand_api_keys.brand_id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);
