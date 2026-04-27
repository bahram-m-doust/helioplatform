import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../shared/auth';

interface BrandRow {
  id: string;
  slug: string;
  display_name: string;
  status: string;
}
interface AgentRow {
  brand_id: string;
  agent_kind: string;
  enabled: boolean;
  published_at: string | null;
  config_json: Record<string, unknown> | null;
}
interface KeyRow {
  id: string;
  label: string;
  prefix: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

/**
 * Brand detail — reads agents + keys via Supabase REST (RLS-scoped).
 *
 * Uses the supabase client directly (not tenant-api) for reads because
 * RLS already covers the safety story and we save a hop. Mutations
 * (issue key, toggle agent, publish) go through the supabase client
 * too — they pass RLS for owners/editors as defined in 0002_rls.sql.
 */
export function BrandDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { client } = useAuth();
  const [brand, setBrand] = useState<BrandRow | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyAgent, setBusyAgent] = useState<string | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !slug) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: brandRows, error: brandErr } = await client
          .from('brands')
          .select('id,slug,display_name,status')
          .eq('slug', slug)
          .limit(1);
        if (brandErr) throw brandErr;
        const b = brandRows?.[0] as BrandRow | undefined;
        if (!b) {
          setError('Brand not found or you are not a member.');
          return;
        }
        if (cancelled) return;
        setBrand(b);
        const [{ data: a, error: ae }, { data: k, error: ke }] = await Promise.all([
          client.from('brand_agents').select('*').eq('brand_id', b.id),
          client.from('brand_api_keys').select('id,label,prefix,created_at,revoked_at,last_used_at').eq('brand_id', b.id),
        ]);
        if (ae || ke) throw ae ?? ke;
        if (cancelled) return;
        setAgents(a ?? []);
        setKeys(k ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load brand.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, slug]);

  const toggleAgent = async (kind: string, enabled: boolean, alsoPublish: boolean) => {
    if (!client || !brand) return;
    setBusyAgent(kind);
    try {
      const update: Record<string, unknown> = { enabled };
      if (alsoPublish) update.published_at = new Date().toISOString();
      const { error: upErr } = await client
        .from('brand_agents')
        .update(update)
        .eq('brand_id', brand.id)
        .eq('agent_kind', kind);
      if (upErr) throw upErr;
      setAgents((rows) => rows.map((r) => (r.agent_kind === kind ? { ...r, ...update } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed.');
    } finally {
      setBusyAgent(null);
    }
  };

  const issueKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !brand) return;
    try {
      // The plaintext secret is generated client-side here only because
      // RLS lets owners INSERT into brand_api_keys directly. For audit
      // sanity we let tenant-api own the issuance flow as the canonical
      // path; a future refactor moves this call to /admin/brands/{id}/api-keys.
      const secret = 'helio_live_' + crypto.randomUUID().replace(/-/g, '');
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
      const hashHex = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const { data, error: insErr } = await client
        .from('brand_api_keys')
        .insert({
          brand_id: brand.id,
          label: newKeyLabel,
          key_hash: '\\x' + hashHex,
          prefix: secret.slice(0, 8),
        })
        .select('id,label,prefix,created_at,revoked_at,last_used_at')
        .single();
      if (insErr) throw insErr;
      setKeys((current) => [data as KeyRow, ...current]);
      setIssuedSecret(secret);
      setNewKeyLabel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Key issuance failed.');
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!brand) return <p className="muted">Loading…</p>;

  return (
    <>
      <h2>{brand.display_name}</h2>
      <p className="muted">slug: <code>{brand.slug}</code> • status: <span className="badge muted">{brand.status}</span></p>

      <section className="card">
        <h3>Agents</h3>
        <p className="muted">Toggle enable + publish so customer requests start succeeding.</p>
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Enabled</th>
              <th>Published</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((row) => (
              <tr key={row.agent_kind}>
                <td><code>{row.agent_kind}</code></td>
                <td>
                  {row.enabled
                    ? <span className="badge good">on</span>
                    : <span className="badge muted">off</span>}
                </td>
                <td>
                  {row.published_at
                    ? <span className="badge good">{new Date(row.published_at).toLocaleDateString()}</span>
                    : <span className="badge muted">—</span>}
                </td>
                <td>
                  <button
                    className="secondary"
                    disabled={busyAgent === row.agent_kind}
                    onClick={() => toggleAgent(row.agent_kind, !row.enabled, !row.enabled && !row.published_at)}
                  >
                    {row.enabled ? 'Disable' : 'Enable + publish'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Server-to-server API keys</h3>
        <p className="muted">
          Keys carry per-brand cost. Issue one per integration (Framer site, Zapier, etc.).
          The secret is shown <strong>once</strong>; store it immediately.
        </p>
        <form onSubmit={issueKey} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>Label</label>
            <input
              required
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
              placeholder="framer-prod"
            />
          </div>
          <button className="primary" type="submit" disabled={!newKeyLabel}>
            Issue key
          </button>
        </form>
        {issuedSecret && (
          <pre className="result" style={{ marginTop: 16 }}>
            New secret (save now):{'\n'}{issuedSecret}
          </pre>
        )}
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Prefix</th>
              <th>Created</th>
              <th>Last used</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.label}</td>
                <td><code>{k.prefix}</code></td>
                <td className="muted">{new Date(k.created_at).toLocaleString()}</td>
                <td className="muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}</td>
                <td>
                  {k.revoked_at
                    ? <span className="badge danger">revoked</span>
                    : <span className="badge good">active</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
