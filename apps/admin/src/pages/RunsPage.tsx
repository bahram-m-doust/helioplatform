import { useEffect, useState } from 'react';
import { useAuth } from '../shared/auth';

interface RunRow {
  id: string;
  brand_id: string;
  agent_kind: string;
  status: string;
  cost_usd: number | null;
  duration_ms: number | null;
  error_code: string | null;
  created_at: string;
}

export function RunsPage() {
  const { client } = useAuth();
  const [rows, setRows] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await client
        .from('agent_runs')
        .select('id,brand_id,agent_kind,status,cost_usd,duration_ms,error_code,created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      setRows(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <>
      <h2>Recent runs</h2>
      <p className="muted">Latest 100 calls across every agent you have access to (RLS-scoped).</p>
      <section className="card">
        {error && <p className="error">{error}</p>}
        {!rows && !error && <p className="muted">Loading…</p>}
        {rows && rows.length === 0 && <p className="muted">No runs yet.</p>}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Cost</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
                  <td><code>{r.agent_kind}</code></td>
                  <td>
                    {r.status === 'succeeded' ? <span className="badge good">{r.status}</span>
                      : r.status === 'failed' ? <span className="badge danger">{r.status}</span>
                      : <span className="badge muted">{r.status}</span>}
                  </td>
                  <td>{r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(4)}` : '—'}</td>
                  <td className="muted">{r.duration_ms != null ? `${r.duration_ms} ms` : '—'}</td>
                  <td className="muted">{r.error_code ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
