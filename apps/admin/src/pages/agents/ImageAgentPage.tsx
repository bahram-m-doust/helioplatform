import { useState } from 'react';
import { useAuth } from '../../shared/auth';
import { callAgent } from './agentTestUtils';

interface GenerateResponse {
  status: string;
  image_url: string;
  prompt: string;
  brand: string;
}

export function ImageAgentPage() {
  const { client } = useAuth();
  const [userRequest, setUserRequest] = useState('A glass tower at golden hour over the Dubai skyline.');
  const [brand, setBrand] = useState<'General' | 'Mansory' | 'Technogym' | 'Binghatti'>('Binghatti');
  const [referenceImages, setReferenceImages] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const refs = referenceImages
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const data = await callAgent<GenerateResponse>({
        agent: 'image',
        path: '/generate',
        body: { user_request: userRequest, brand, reference_images: refs },
        client,
        apiKey: apiKey.trim() || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>Image agent — live test</h2>
      <p className="muted">
        Calls <code>POST /v1/image/generate</code>. Use the X-API-Key field below to test the
        server-to-server path; leave it empty to use your Supabase JWT.
      </p>
      <section className="card">
        <form onSubmit={submit}>
          <label>Description</label>
          <textarea value={userRequest} onChange={(e) => setUserRequest(e.target.value)} required />
          <label>Brand</label>
          <select value={brand} onChange={(e) => setBrand(e.target.value as typeof brand)}>
            <option>General</option>
            <option>Mansory</option>
            <option>Technogym</option>
            <option>Binghatti</option>
          </select>
          <label>Reference image URLs (one per line, optional)</label>
          <textarea value={referenceImages} onChange={(e) => setReferenceImages(e.target.value)} placeholder="https://example.com/ref1.jpg" />
          <label>X-API-Key (optional, blank = use your JWT)</label>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="helio_live_…" autoComplete="off" />
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Generating…' : 'Generate image'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="card">
          <h3>Result</h3>
          <p>
            <a href={result.image_url} target="_blank" rel="noreferrer">{result.image_url}</a>
          </p>
          <img src={result.image_url} alt="generated" style={{ maxWidth: '100%', borderRadius: 6 }} />
          <h4>Prompt used</h4>
          <pre className="result">{result.prompt}</pre>
        </section>
      )}
    </>
  );
}
