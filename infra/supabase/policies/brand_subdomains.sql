-- RLS for brand_subdomains.
--
-- This is a routing table; the agents need to read it to resolve
-- ``binghatti.platform.helio.ae -> brand_id``. Therefore READ is open to
-- everyone (including the anon key). WRITE is restricted to admins (the
-- ``helio_admin`` role claim) — Framer subdomain provisioning is an
-- internal operation, never customer-driven.

alter table brand_subdomains enable row level security;

create policy "anyone can read brand subdomains"
on brand_subdomains
for select
using (true);

create policy "admins can manage brand subdomains"
on brand_subdomains
for all
to authenticated
using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'helio_admin'
)
with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'helio_admin'
);
