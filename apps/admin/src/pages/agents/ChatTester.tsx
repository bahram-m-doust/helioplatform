import { useState } from 'react';
import { useAuth } from '../../shared/auth';
import { callAgent } from './agentTestUtils';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  status: string;
  reply: string;
}

interface Props {
  title: string;
  agent: string;
  buildBody: (messages: Message[]) => unknown;
  extraFields?: React.ReactNode;
  welcome?: string;
}

/**
 * Generic multi-turn chat tester. Used by storyteller, campaign-maker,
 * and soul-print which all share the same shape: send the full message
 * transcript on every request, get back a single ``reply``.
 */
export function ChatTester({ title, agent, buildBody, extraFields, welcome }: Props) {
  const { client } = useAuth();
  const [messages, setMessages] = useState<Message[]>(
    welcome ? [{ role: 'assistant', content: welcome }] : [],
  );
  const [draft, setDraft] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    const next: Message[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const data = await callAgent<ChatResponse>({
        agent,
        path: '/chat',
        body: buildBody(next.filter((m) => m.role === 'user' || m.role === 'assistant')),
        client,
        apiKey: apiKey.trim() || undefined,
      });
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMessages(welcome ? [{ role: 'assistant', content: welcome }] : []);
    setError(null);
  };

  return (
    <>
      <h2>{title}</h2>
      <p className="muted">
        Calls <code>POST /v1/{agent}/chat</code> with the full transcript on each turn.
      </p>
      <section className="card">
        {extraFields}
        <label>X-API-Key (optional, blank = use your JWT)</label>
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="helio_live_…" autoComplete="off" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span className="muted">Messages: {messages.length}</span>
          <button className="secondary" type="button" onClick={reset}>Reset conversation</button>
        </div>
      </section>

      <section className="card">
        <h3>Conversation</h3>
        {messages.length === 0 && <p className="muted">No messages yet.</p>}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div className="muted" style={{ fontSize: '0.78rem' }}>{m.role}</div>
            <pre className="result" style={{ marginTop: 4 }}>{m.content}</pre>
          </div>
        ))}
        <form onSubmit={send} style={{ marginTop: 12 }}>
          <label>Your message</label>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} required />
          <button className="primary" type="submit" disabled={busy || !draft.trim()}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    </>
  );
}
