import { useState } from 'react';
import { useAuth } from '../shared/auth';

type Mode = 'password' | 'magic';

export function LoginPage() {
  const { signInWithPassword, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'password') {
        await signInWithPassword(email, password);
      } else {
        await signInWithMagicLink(email);
        setInfo('Magic link sent. Check your inbox.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="card">
        <h2>Helio Admin sign-in</h2>
        <p className="muted">Sign in with your Supabase account to manage brands and test agents.</p>
        <form onSubmit={submit}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {mode === 'password' && (
            <>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : mode === 'password' ? 'Sign in' : 'Send magic link'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          {mode === 'password' ? (
            <a href="#" onClick={(e) => { e.preventDefault(); setMode('magic'); }}>
              Use magic link instead
            </a>
          ) : (
            <a href="#" onClick={(e) => { e.preventDefault(); setMode('password'); }}>
              Use password instead
            </a>
          )}
        </p>
        {error && <p className="error">{error}</p>}
        {info && <p className="muted">{info}</p>}
      </section>
    </div>
  );
}
