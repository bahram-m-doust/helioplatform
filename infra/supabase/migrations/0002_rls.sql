-- Helio Platform — Row-level security policies.
--
-- This migration is the aggregator: each per-table policy lives in
-- ``infra/supabase/policies/<table>.sql`` so reviewers can scan exactly
-- one file per table. Migrations is the only place where they're
-- combined into one SQL file the Supabase CLI can apply.
--
-- IMPORTANT: every tenant-scoped table has RLS enabled. The service
-- role (``SUPABASE_SERVICE_ROLE_KEY``) bypasses RLS entirely; that key
-- lives ONLY in services/tenant-api. Agents never see it; they call
-- Supabase with the user's JWT (browser path) or do explicit
-- ``where brand_id = $1`` filtering (X-API-Key path).

\ir ../policies/brands.sql
\ir ../policies/brand_members.sql
\ir ../policies/brand_api_keys.sql
\ir ../policies/brand_subdomains.sql
\ir ../policies/brand_agents.sql
\ir ../policies/brand_quotas.sql
\ir ../policies/agent_runs.sql
