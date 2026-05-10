/**
 * فرامر — Soul Print (همان منطق SoulPrintPage: مستقیم OpenRouter)
 *
 * ۱) OPENROUTER_API_KEY را در Framer ست کن (کلید در مرورگر کاربر دیده می‌شود — برای تولید،
 *    بهتر است بعداً یک بک‌اند پروکسی روی Helio اضافه شود).
 * ۲) برای prompt کامل استراتژیک، متن `SYSTEM_PROMPT` را از
 *    apps/main-app/frontend/src/features/agents/soul-print/SoulPrintPage.tsx (ثابت SYSTEM_PROMPT)
 *    جایگزین نسخهٔ کوتاه زیر کن.
 */
import * as React from 'react'

const ACCENT = '#22ccee'
const ACCENT_ON_LIGHT = '#0e7490'
const ACCESS_PASSWORD = 'kan00n123456'

/** مقداردهی اجباری قبل از استفاده در production. */
const OPENROUTER_API_KEY = ''

const OPENROUTER_MODEL = 'openai/gpt-4o'
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** نسخهٔ فشرده؛ برای parity کامل با اپ، بلوک SYSTEM_PROMPT اصلی را از SoulPrintPage.tsx کپی کن. */
const SYSTEM_PROMPT = `You are a Brand Strategy Agent for Soul Print. You help founders translate Soulprints into a coherent "city" model for the brand: goal, culture, audiences, tensions, rituals, and a Story of the City.

Work in clear phases. Do not jump to slogans before strategic structure. Ask for brand name, links, category, founder count, and Soulprint-related documents when missing.

When the user attaches .doc/.docx (as file payloads), read and integrate them. Write with clarity and warmth, not robotic consultant tone.

Deliver in structured sections when appropriate. If the user writes in Persian, respond in natural Persian unless they ask otherwise.`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface PendingFile {
  id: string
  name: string
  dataUrl: string
}

const MAX_FILES = 5

function parseProviderError(status: number, errorText: string): string {
  let msg = `API request failed with status ${status}.`
  try {
    const p = JSON.parse(errorText)
    msg = p?.error?.metadata?.raw || p?.error?.message || p?.message || msg
  } catch {
    if (errorText.trim()) msg = errorText.trim()
  }
  return msg
}

function extractAssistantContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: string }).text === 'string') {
          return (part as { text: string }).text
        }
        return ''
      })
      .filter(Boolean)
    if (parts.length) return parts.join('\n').trim()
  }
  return 'No response from model.'
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error ?? new Error(`Could not read ${file.name}`))
    r.readAsDataURL(file)
  })

export default function HelioSoulPrintFramer() {
  const [unlocked, setUnlocked] = React.useState(false)
  const [showPass, setShowPass] = React.useState(false)
  const [accessPass, setAccessPass] = React.useState('')
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<Message[]>([])
  const [pending, setPending] = React.useState<PendingFile[]>([])
  const [loading, setLoading] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const soulGateRef = React.useRef<{ userLine: string; uploads: PendingFile[]; summary: string } | null>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, pending])

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    e.target.value = ''
    if (!files?.length) return
    const next: PendingFile[] = [...pending]
    for (let i = 0; i < files.length && next.length < MAX_FILES; i++) {
      const f = files[i]
      const dataUrl = await fileToDataUrl(f)
      next.push({
        id: `${f.name}-${Date.now()}-${i}`,
        name: f.name,
        dataUrl,
      })
    }
    setPending(next.slice(0, MAX_FILES))
  }

  function removeFile(id: string) {
    setPending((p) => p.filter((x) => x.id !== id))
  }

  async function deliverSoul(payload: { userLine: string; uploads: PendingFile[]; summary: string }) {
    const { userLine, uploads, summary } = payload
    setInput('')
    setPending([])
    const next: Message[] = [...messages, { role: 'user', content: summary }]
    setMessages(next)

    if (!OPENROUTER_API_KEY) {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: 'Set OPENROUTER_API_KEY at the top of this component (Framer code).',
        },
      ])
      return
    }

    const hasFiles = uploads.length > 0
    setLoading(true)
    const ac = new AbortController()
    const to = window.setTimeout(() => ac.abort(), 120_000)
    try {
      const prevForApi = next.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))

      const lastUser =
        hasFiles && uploads.length > 0
          ? {
              role: 'user' as const,
              content: [
                { type: 'text', text: userLine },
                ...uploads.map((u) => ({
                  type: 'file',
                  file: { filename: u.name, file_data: u.dataUrl },
                })),
              ],
            }
          : { role: 'user' as const, content: userLine }

      const res = await fetch(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
          'X-OpenRouter-Title': 'Helio Soul Print',
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...prevForApi, lastUser],
        }),
        signal: ac.signal,
      })

      if (!res.ok) throw new Error(parseProviderError(res.status, await res.text()))
      const data = await res.json()
      const assistant = extractAssistantContent(data?.choices?.[0]?.message?.content)
      setMessages([...next, { role: 'assistant', content: assistant }])
    } catch (e) {
      let err = 'Request failed. Try again.'
      if (e instanceof Error && e.name === 'AbortError') err = 'Timed out.'
      else if (e instanceof Error && e.message) err = e.message
      setMessages([...next, { role: 'assistant', content: err }])
    } finally {
      clearTimeout(to)
      setLoading(false)
    }
  }

  async function onSend() {
    const text = input.trim()
    const hasFiles = pending.length > 0
    if (!text && !hasFiles) return

    const userLine = text || 'I have uploaded founder files for analysis.'
    const summary = hasFiles ? `${userLine}\n\nUploaded:\n${pending.map((p) => `- ${p.name}`).join('\n')}` : userLine

    if (!unlocked) {
      soulGateRef.current = {
        userLine,
        uploads: pending.map((p) => ({ ...p })),
        summary,
      }
      setShowPass(true)
      return
    }

    await deliverSoul({ userLine, uploads: [...pending], summary })
  }

  function confirmPass() {
    if (accessPass !== ACCESS_PASSWORD) return
    setUnlocked(true)
    setShowPass(false)
    setAccessPass('')
    const g = soulGateRef.current
    soulGateRef.current = null
    if (g) void deliverSoul(g)
  }

  function cancelPass() {
    setShowPass(false)
    setAccessPass('')
    soulGateRef.current = null
  }

  const box: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    position: 'relative',
    height: '100%',
    minHeight: 520,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e5e5',
    borderRadius: 16,
    background: '#fff',
    overflow: 'hidden',
  }

  return (
    <div style={box}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f5f5f5', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #e5e5e5',
            background: '#fafafa',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Attach Word files
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          style={{ display: 'none' }}
          onChange={onPickFiles}
        />
        <span style={{ fontSize: 12, color: '#737373' }}>Up to {MAX_FILES} documents</span>
      </div>

      {pending.length > 0 ? (
        <div style={{ padding: '8px 20px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
          {pending.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{p.name}</span>
              <button type="button" onClick={() => removeFile(p.id)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {messages.length === 0 ? (
          <p style={{ color: '#737373', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Welcome to Soul Print. Optionally attach founder documents above, write your message, then send.
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
        {loading ? <div style={{ color: '#525252', fontWeight: 600 }}>Thinking…</div> : null}
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
            placeholder="Message Soul Print…"
            style={{
              width: '100%',
              minHeight: 52,
              maxHeight: 140,
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
            disabled={loading || (!input.trim() && pending.length === 0)}
            onClick={onSend}
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? '#e5e5e5' : ACCENT,
              color: loading ? '#a3a3a3' : '#0a0a0a',
              fontWeight: 700,
            }}
          >
            →
          </button>
        </div>
      </div>
      {showPass ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            borderRadius: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minWidth: 280,
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            }}
          >
            <input
              type="password"
              value={accessPass}
              onChange={(e) => setAccessPass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirmPass()
                }
              }}
              placeholder="Password"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #e5e5e5',
                fontSize: 15,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={cancelPass}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid #e5e5e5',
                  background: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPass}
                style={{
                  padding: '10px 16px',
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
          </div>
        </div>
      ) : null}
    </div>
  )
}
