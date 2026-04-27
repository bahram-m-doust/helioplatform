-- RLS for brand_members.
--
-- A user can read the membership rows for any brand they belong to (so
-- the admin UI can list co-members). Only owners can insert/update/delete
-- membership rows.

alter table brand_members enable row level security;

create policy "members can read membership of their brands"
on brand_members
for select
to authenticated
using (
    exists (
        select 1 from brand_members self
        where self.brand_id = brand_members.brand_id
          and self.user_id = auth.uid()
    )
);

create policy "owners can manage membership"
on brand_members
for all
to authenticated
using (
    exists (
        select 1 from brand_members owner_row
        where owner_row.brand_id = brand_members.brand_id
          and owner_row.user_id = auth.uid()
          and owner_row.role = 'owner'
    )
)
with check (
    exists (
        select 1 from brand_members owner_row
        where owner_row.brand_id = brand_members.brand_id
          and owner_row.user_id = auth.uid()
          and owner_row.role = 'owner'
    )
);
