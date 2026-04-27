import { useState } from 'react';
import { useAuth } from '../../shared/auth';
import { callAgent } from './agentTestUtils';

interface GenerateResponse {
  status: string;
  video_url: string;
  prompt: string;
  brand: string;
  duration: number;
}

export function VideoAgentPage() {
  const { client } = useAuth();
  const [userRequest, setUserRequest] = useState('A slow cinematic push-in toward the tower while clouds drift past.');
  const [imageUrl, setImageUrl] = useState('');
  const [brand, setBrand] = useState<'General' | 'Mansory' | 'Technogym' | 'Binghatti'>('Binghatti');
  const [duration, setDuration] = useState(5);
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
      const data = await callAgent<GenerateResponse>({
        agent: 'video',
        path: '/generate',
        body: { user_request: userRequest, image_url: imageUrl, brand, duration },
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
      <h2>Video agent — live test</h2>
      <p className="muted">
        Calls <code>POST /v1/video/generate</code>. Image-to-video; the keyframe URL is the first frame.
      </p>
      <section className="card">
        <form onSubmit={submit}>
          <label>Motion description</label>
          <textarea value={userRequest} onChange={(e) => setUserRequest(e.target.value)} required />
          <label>Keyframe image URL</label>
          <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required placeholder="https://example.com/keyframe.jpg" />
          <label>Brand</label>
          <select value={brand} onChange={(e) => setBrand(e.target.value as typeof brand)}>
            <option>General</option>
            <option>Mansory</option>
            <option>Technogym</option>
            <option>Binghatti</option>
          </select>
          <label>Duration (seconds, 1-10)</label>
          <input type="number" min={1} max={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          <label>X-API-Key (optional, blank = use your JWT)</label>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="helio_live_…" autoComplete="off" />
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Rendering (can take ~60s)…' : 'Generate video'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="card">
          <h3>Result</h3>
          <p>
            <a href={result.video_url} target="_blank" rel="noreferrer">{result.video_url}</a>
          </p>
          <video src={result.video_url} controls style={{ maxWidth: '100%', borderRadius: 6 }} />
          <h4>Motion prompt used</h4>
          <pre className="result">{result.prompt}</pre>
        </section>
      )}
    </>
  );
}
