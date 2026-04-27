-- RLS for brands.
--
-- Members read; only owners can update/delete; only authenticated users
-- can insert (and the trigger sets owner_user_id = auth.uid() so they
-- become the owner). Service role (used by services/tenant-api) bypasses
-- RLS entirely.

alter table brands enable row level security;

-- READ: any user who is a member of the brand can see it.
create policy "members can read their brands"
on brands
for select
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brands.id
          and m.user_id = auth.uid()
    )
    or owner_user_id = auth.uid()
);

-- INSERT: any authenticated user can create a brand. The brand becomes
-- "owned" by them via owner_user_id; the matching brand_members row is
-- inserted by services/tenant-api inside the same transaction.
create policy "any authenticated user can create a brand"
on brands
for insert
to authenticated
with check (owner_user_id = auth.uid());

-- UPDATE / DELETE: only members with role='owner' may mutate the brand row.
create policy "owners can update their brand"
on brands
for update
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brands.id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
)
with check (
    exists (
        select 1 from brand_members m
        where m.brand_id = brands.id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);

create policy "owners can delete their brand"
on brands
for delete
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = brands.id
          and m.user_id = auth.uid()
          and m.role = 'owner'
    )
);
