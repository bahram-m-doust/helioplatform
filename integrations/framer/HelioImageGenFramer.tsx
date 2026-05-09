/**
 * فرامر — کپی کل این فایل داخل Framer › Code › Custom Component
 *
 * مهم: اگر دامنه سایت (مثل platform.helio.ae) روی Framer است، مسیرهای `/api/image/...`
 * روی همان دامنه به Framer می‌خورد و 404 می‌دهد. API باید به همان «edge»ی باشد که
 * nginx سرویس image-generator را بالا می‌آورد (در این ریپو معمولاً همان PUBLIC_URL مثل api.helio.ae).
 *
 * ۱) HELIO_EDGE_ORIGIN را با دامنه واقعی API ست کن.
 * ۲) لوگوی مرجع برندها را در BRAND_REFERENCE_URLS پر کن یا خالی بگذار.
 * رنگ تأکید: #22ccee مطابق دکمه فوتر main-app.
 */
import * as React from 'react'

/** Same accent as SiteFooter CTA (cyan / brand blue). */
const ACCENT = '#22ccee'
const ACCENT_ON_LIGHT = '#0e7490'
const ACCESS_PASSWORD = 'kan00n123456'

/** دامنه لبهٔ Helio که `/api/image/` را به image-generator می‌دهد — نه دامنهٔ صفحهٔ Framer. */
const HELIO_EDGE_ORIGIN = 'https://api.helio.ae'

const PROMPT_URL = `${HELIO_EDGE_ORIGIN}/api/image/api/prompt`
const GENERATE_URL = `${HELIO_EDGE_ORIGIN}/api/image/api/generate`

type BrandKey = 'Mansory' | 'Technogym' | 'Binghatti'

const BRAND_OPTIONS: BrandKey[] = ['Mansory', 'Technogym', 'Binghatti']

/** آدرس تصاویر مرجع هر برند (fetch باید از مرورگر مجاز باشد — CORS). */
const BRAND_REFERENCE_URLS: Record<BrandKey, string[]> = {
  Mansory: [],
  Technogym: [],
  Binghatti: [],
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  imageBrand?: BrandKey
}

const LEAK = [
  'you are the dedicated',
  'primary objective',
  'execution instructions',
  'user image request',
  'output format',
  'final internal check',
  'scene type routing',
  'prompt construction order',
]

function sanitizeErrorMessage(message: string, fallback: string): string {
  const compact = message.trim().replace(/\s+/g, ' ')
  if (!compact) return fallback
  const n = compact.toLowerCase()
  if (LEAK.some((m) => n.includes(m)) || compact.length > 420) return fallback
  return compact
}

function parseApiError(status: number, payload: string): string {
  const fb = `Image generation failed with status ${status}.`
  let msg = fb
  try {
    const p = JSON.parse(payload)
    msg = p?.detail || p?.error || p?.message || msg
  } catch {
    if (payload.trim()) msg = payload.trim()
  }
  return sanitizeErrorMessage(String(msg), fb)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error ?? new Error('read failed'))
    r.readAsDataURL(blob)
  })
}

export default function HelioImageGenFramer() {
  const [unlocked, setUnlocked] = React.useState(false)
  const [accessPass, setAccessPass] = React.useState('')
  const [brand, setBrand] = React.useState<BrandKey>('Mansory')
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<Message[]>([])
  const [loading, setLoading] = React.useState(false)
  const [stage, setStage] = React.useState('Generating...')
  const refCache = React.useRef<Partial<Record<BrandKey, string[]>>>({})
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, stage])

  async function referenceDataUrls(b: BrandKey): Promise<string[]> {
    const urls = BRAND_REFERENCE_URLS[b]
    if (!urls.length) return []
    const cached = refCache.current[b]
    if (cached?.length) return cached
    const out: string[] = []
    for (const u of urls) {
      const res = await fetch(u)
      if (!res.ok) throw new Error(`Could not load reference for ${b}`)
      out.push(await blobToDataUrl(await res.blob()))
    }
    refCache.current[b] = out
    return out
  }

  async function onSend() {
    const text = input.trim()
    if (!text) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    const ac = new AbortController()
    const to = window.setTimeout(() => ac.abort(), 240_000)
    try {
      setStage('Generating (1/2)...')
      const pr = await fetch(PROMPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, user_request: text }),
        signal: ac.signal,
      })
      if (!pr.ok) throw new Error(parseApiError(pr.status, await pr.text()))
      const pj = (await pr.json()) as { final_prompt?: string; detail?: string; error?: string }
      const finalPrompt = (pj.final_prompt || '').trim()
      if (!finalPrompt) {
        throw new Error(sanitizeErrorMessage(pj.detail || pj.error || '', 'Empty prompt from API.'))
      }
      setStage('Generating (2/2)...')
      const imageInput = await referenceDataUrls(brand)
      const gr = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          image_input: imageInput,
          brand,
          user_request: text,
        }),
        signal: ac.signal,
      })
      if (!gr.ok) throw new Error(parseApiError(gr.status, await gr.text()))
      const g = (await gr.json()) as { image_url?: string; detail?: string; error?: string }
      const imageUrl = typeof g.image_url === 'string' ? g.image_url : ''
      if (!imageUrl) throw new Error(g.detail || g.error || 'No image URL')
      setMessages([
        ...next,
        { role: 'assistant', content: 'Image generated successfully.', imageUrl, imageBrand: brand },
      ])
    } catch (e) {
      let err = 'Sorry, image generation failed. Please try again.'
      if (e instanceof Error && e.name === 'AbortError') err = 'Timed out. Try again.'
      else if (e instanceof TypeError) err = 'Network / CORS error — check API URL and browser console.'
      else if (e instanceof Error && e.message) err = sanitizeErrorMessage(e.message, err)
      setMessages([...next, { role: 'assistant', content: err }])
    } finally {
      clearTimeout(to)
      setLoading(false)
      setStage('Generating...')
    }
  }

  const box: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 480,
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {BRAND_OPTIONS.map((b) => (
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
                lineHeight: 1.5,
                background: m.role === 'user' ? '#171717' : '#f5f5f5',
                color: m.role === 'user' ? '#fff' : '#262626',
                borderTopRightRadius: m.role === 'user' ? 4 : 16,
                borderTopLeftRadius: m.role === 'assistant' ? 4 : 16,
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              {m.imageUrl ? (
                <div style={{ marginTop: 14 }}>
                  <a href={m.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                    <div
                      style={{
                        aspectRatio: '16/9',
                        borderRadius: 12,
                        border: '1px solid #e5e5e5',
                        overflow: 'hidden',
                        background: '#fff',
                      }}
                    >
                      <img
                        src={m.imageUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    </div>
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#f5f5f5',
                border: '1px solid #e5e5e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: ACCENT_ON_LIGHT,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              AI
            </div>
            <div
              style={{
                background: '#f5f5f5',
                borderRadius: 16,
                borderTopLeftRadius: 4,
                padding: '14px 18px',
                fontSize: 14,
                color: '#404040',
                fontWeight: 600,
              }}
            >
              {stage}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #f5f5f5', background: '#fff' }}>
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
            rows={1}
            placeholder="Describe the image you want..."
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
              fontSize: 16,
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
