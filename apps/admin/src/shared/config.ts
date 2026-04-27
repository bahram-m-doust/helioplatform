// Build-time config (Vite injects VITE_* env vars). Defaults work for
// local dev; production overrides come from .env.prod via the
// docker-compose build args.

const env = import.meta.env;

export const SUPABASE_URL: string = (env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY: string = (env.VITE_SUPABASE_ANON_KEY ?? '').trim();

// All admin->backend calls go through ``api.helio.ae`` (or its dev
// equivalent). Empty default = relative paths, useful when the admin
// SPA is served from the same origin in dev.
export const API_BASE_URL: string = (env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

// Per-agent /v1 endpoints — built off the base above.
export const agentEndpoint = (agent: string, suffix: string): string => {
  const base = API_BASE_URL || '';
  return `${base}/v1/${agent}${suffix}`;
};

export const tenantEndpoint = (suffix: string): string => {
  const base = API_BASE_URL || '';
  return `${base}/api/tenant${suffix}`;
};

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
