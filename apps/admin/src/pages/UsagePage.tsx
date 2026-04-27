import { useEffect, useState } from 'react';
import { useAuth } from '../shared/auth';
import { tenantEndpoint } from '../shared/config';
import { apiFetch } from '../shared/api';

interface UsageRow {
  brand_id: string;
  agent_kind: string;
  period_start: string;
  succeeded_count: number;
  failed_count: number;
  total_cost_usd: number;
  avg_duration_ms: number;
  last_run_at: string | null;
}

export function UsagePage() {
  const { client } = useAuth();
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UsageRow[]>(tenantEndpoint('/me/usage'), { client })
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [client]);

  // Group rows by brand_id for a friendlier render. Sort by total cost desc.
  const grouped = rows
    ? Object.values(
        rows.reduce<Record<string, { brand_id: string; total: number; rows: UsageRow[] }>>(
          (acc, row) => {
            const key = row.brand_id;
            const bucket = acc[key] ?? { brand_id: key, total: 0, rows: [] };
            bucket.rows.push(row);
            bucket.total += Number(row.total_cost_usd);
            acc[key] = bucket;
            return acc;
          },
          {},
        ),
      ).sort((a, b) => b.total - a.total)
    : [];

  return (
    <>
      <h2>Usage / cost</h2>
      <p className="muted">
        Per-brand spend rolled up from <code>agent_runs</code>. Use this to see which brand is
        burning quota and tune <code>brand_quotas.monthly_budget_cents</code>.
      </p>
      <section className="card">
        {error && <p className="error">{error}</p>}
        {!rows && !error && <p className="muted">Loading…</p>}
        {rows && rows.length === 0 && <p className="muted">No runs recorded yet.</p>}
        {grouped.map((group) => (
          <div key={group.brand_id} style={{ marginBottom: 24 }}>
            <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><code>{group.brand_id.slice(0, 8)}…</code></span>
              <span style={{ color: 'var(--accent-strong)' }}>${group.total.toFixed(4)}</span>
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Agent</th>
                  <th>Succeeded</th>
                  <th>Failed</th>
                  <th>Total cost</th>
                  <th>Avg duration</th>
                  <th>Last run</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r) => (
                  <tr key={`${r.agent_kind}-${r.period_start}`}>
                    <td className="muted">{r.period_start}</td>
                    <td><code>{r.agent_kind}</code></td>
                    <td>{r.succeeded_count}</td>
                    <td>{r.failed_count}</td>
                    <td>${Number(r.total_cost_usd).toFixed(4)}</td>
                    <td className="muted">{r.avg_duration_ms} ms</td>
                    <td className="muted">{r.last_run_at ? new Date(r.last_run_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </>
  );
}
