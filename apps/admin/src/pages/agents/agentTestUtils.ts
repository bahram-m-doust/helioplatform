/**
 * Shared utilities for the agent test pages.
 *
 * Each page is a thin React component that:
 *   1. Lets the operator pick the brand (so X-API-Key vs Supabase JWT
 *      both work — RLS will scope by brand_id either way).
 *   2. Submits a form to the agent's /v1/<agent>/<endpoint>.
 *   3. Renders the response (image URL, video URL, chat reply, etc.).
 *
 * Keeping the call helpers here means the per-agent page files stay
 * tiny and focused on the form shape.
 */

import { agentEndpoint } from '../../shared/config';
import { apiFetch } from '../../shared/api';
import { SupabaseClient } from '@supabase/supabase-js';

export interface AgentCallOpts {
  agent: string;
  path: string;          // '/generate' | '/chat'
  body: unknown;
  client: SupabaseClient | null;
  apiKey?: string;       // optional — if set, sent as X-API-Key INSTEAD of JWT
}

export async function callAgent<T>({
  agent,
  path,
  body,
  client,
  apiKey,
}: AgentCallOpts): Promise<T> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  return apiFetch<T>(agentEndpoint(agent, path), {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
    client: apiKey ? null : client, // skip JWT injection when sending X-API-Key
  });
}
