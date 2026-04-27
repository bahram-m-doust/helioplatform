-- RLS for agent_runs.
--
-- Read-only for members. INSERT is restricted to the service role —
-- agents do not write through Supabase auth; tenant-api / agents call
-- with the service role key for audit writes (and explicitly filter
-- ``brand_id`` in the INSERT). UPDATE / DELETE are forbidden because
-- this table is meant to be append-only audit log.

alter table agent_runs enable row level security;

create policy "members can read agent_runs for their brands"
on agent_runs
for select
to authenticated
using (
    exists (
        select 1 from brand_members m
        where m.brand_id = agent_runs.brand_id
          and m.user_id = auth.uid()
    )
);

-- No INSERT / UPDATE / DELETE policies for the ``authenticated`` role:
-- only the service role (which bypasses RLS) may write to this table.
