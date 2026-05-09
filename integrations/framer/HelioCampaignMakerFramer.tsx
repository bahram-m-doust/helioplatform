/**
 * فرامر — Campaign Maker Agent (همان CampaignMakerPage)
 *
 * Endpoint: POST { brand, messages } → { reply }
 */
import * as React from 'react'

const ACCENT = '#22ccee'
const ACCENT_ON_LIGHT = '#0e7490'
const ACCESS_PASSWORD = 'kan00n123456'

const HELIO_EDGE_ORIGIN = 'https://api.helio.ae'
const CHAT_URL = `${HELIO_EDGE_ORIGIN}/api/campaign/api/chat`

const BRANDS = ['Mansory', 'Technogym', 'Binghatti'] as const

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function parseBackendError(status: number, bodyText: string): string {
  const fb = `Service failed with status ${status}.`
  const t = (bodyText || '').trim()
  if (!t) return fb
  try {
    const p = JSON.parse(t)
    return p?.detail || p?.error || p?.message || fb
  } catch {
    return t.length > 400 ? fb : t
  }
}

export default function HelioCampaignMakerFramer() {
  const [unlocked, setUnlocked] = React.useState(false)
  const [accessPass, setAccessPass] = React.useState('')
  const [brand, setBrand] = React.useState<string>(BRANDS[0])
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<Message[]>([])
  const [loading, setLoading] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function onSend() {
    const text = input.trim()
    if (!text) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    const ac = new AbortController()
    const to = window.setTimeout(() => ac.abort(), 120_000)
    try {
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: ac.signal,
      })
      if (!res.ok) throw new Error(parseBackendError(res.status, await res.text()))
      const data = (await res.json()) as { reply?: string }
      const reply = (data.reply || '').trim() || 'No reply from Campaign Maker.'
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (e) {
      let err = 'Request failed. Try again.'
      if (e instanceof Error && e.name === 'AbortError') err = 'Timed out.'
      else if (e instanceof TypeError) err = `Not reachable (${CHAT_URL}). Check CORS / edge URL.`
      else if (e instanceof Error && e.message) err = e.message
      setMessages([...next, { role: 'assistant', content: err }])
    } finally {
      clearTimeout(to)
      setLoading(false)
    }
  }

  const box: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    height: '100%',
    minHeight: 480,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e5e5',
    borderRadius: 16,
    background: '#fff',
    overflow: 'hidden',
  }

  if (!unlocked) {
    return (
      <div
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 320,
          padding: 24,
          border: '1px solid #e5e5e5',
          borderRadius: 16,
          background: '#fff',
          gap: 12,
        }}
      >
        <input
          type="password"
          value={accessPass}
          onChange={(e) => setAccessPass(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const v = (e.currentTarget as HTMLInputElement).value
              if (v === ACCESS_PASSWORD) setUnlocked(true)
            }
          }}
          placeholder="Password"
          style={{
            width: '100%',
            maxWidth: 280,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #e5e5e5',
            fontSize: 15,
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (accessPass === ACCESS_PASSWORD) setUnlocked(true)
          }}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: ACCENT,
            color: '#0a0a0a',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Continue
        </button>
      </div>
    )
  }

  return (
    <div style={box}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f5' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#525252', marginBottom: 8 }}>Select Brand</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {BRANDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrand(b)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${brand === b ? ACCENT : '#e5e5e5'}`,
                background: brand === b ? ACCENT : '#fff',
                color: '#171717',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {messages.length === 0 ? (
          <p style={{ color: '#737373', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Welcome to Campaign Maker. Choose a brand profile and describe your campaign goals.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 20,
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                background: m.role === 'user' ? '#171717' : '#f5f5f5',
                color: m.role === 'user' ? '#fff' : ACCENT_ON_LIGHT,
                border: m.role === 'user' ? 'none' : '1px solid #e5e5e5',
              }}
            >
              {m.role === 'user' ? 'U' : 'AI'}
            </div>
            <div
              style={{
                maxWidth: '85%',
                borderRadius: 16,
                padding: '14px 18px',
                fontSize: 14,
                lineHeight: 1.55,
                background: m.role === 'user' ? '#171717' : '#f5f5f5',
                color: m.role === 'user' ? '#fff' : '#262626',
                borderTopRightRadius: m.role === 'user' ? 4 : 16,
                borderTopLeftRadius: m.role === 'assistant' ? 4 : 16,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading ? (
          <div style={{ color: '#525252', fontSize: 14, fontWeight: 600 }}>Thinking…</div>
        ) : null}
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #f5f5f5' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder="Type your message..."
            style={{
              width: '100%',
              minHeight: 52,
              maxHeight: 120,
              resize: 'none',
              boxSizing: 'border-box',
              padding: '14px 48px 14px 16px',
              borderRadius: 12,
              border: '1px solid #e5e5e5',
              background: '#fafafa',
              fontSize: 14,
            }}
          />
          <button
            type="button"
            disabled={loading || !input.trim()}
            onClick={onSend}
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              background: loading || !input.trim() ? '#e5e5e5' : ACCENT,
              color: loading || !input.trim() ? '#a3a3a3' : '#0a0a0a',
              fontWeight: 700,
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
