import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantEndpoint } from '../shared/config';
import { useAuth } from '../shared/auth';
import { apiFetch } from '../shared/api';

interface Membership {
  brand_id: string;
  slug: string;
  display_name: string;
  role: 'owner' | 'editor' | 'viewer';
}

export function BrandsListPage() {
  const { client } = useAuth();
  const [rows, setRows] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Membership[]>(tenantEndpoint('/me/brands'), { client })
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [client]);

  return (
    <>
      <h2>Your brands</h2>
      <p className="muted">
        Brands you're a member of. Click one to manage agents, API keys, and members.
      </p>
      <section className="card">
        {error && <p className="error">{error}</p>}
        {!rows && !error && <p className="muted">Loading…</p>}
        {rows && rows.length === 0 && (
          <p className="muted">
            You're not a member of any brand yet. Ask an admin to add you, or sign up with a
            <code> brand_code</code> in the metadata.
          </p>
        )}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Slug</th>
                <th>Display name</th>
                <th>Your role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.brand_id}>
                  <td>
                    <code>{row.slug}</code>
                  </td>
                  <td>{row.display_name}</td>
                  <td>
                    <span className="badge muted">{row.role}</span>
                  </td>
                  <td>
                    <Link to={`/brands/${row.slug}`}>Manage →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
