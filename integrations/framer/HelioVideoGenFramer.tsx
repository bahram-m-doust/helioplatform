/**
 * فرامر — Video Generator (همان pipeline چهارمرحله‌ای VideoGeneratorPage)
 *
 * مهم: HELIO_EDGE_ORIGIN = دامنه‌ای که nginx مسیرهای /api/image و /api/video را سرو می‌کند (معمولاً api.helio.ae).
 * نیاز به image-generator + video-generator هم‌زمان روی سرور.
 */
import * as React from 'react'

const ACCENT = '#22ccee'
const ACCENT_ON_LIGHT = '#0e7490'
const ACCESS_PASSWORD = 'kan00n123456'

const HELIO_EDGE_ORIGIN = 'https://api.helio.ae'

const VIDEO_IMAGE_PROMPT_URL = `${HELIO_EDGE_ORIGIN}/api/video/api/image-prompt`
const IMAGE_GENERATION_URL = `${HELIO_EDGE_ORIGIN}/api/image/api/generate`
const VIDEO_PROMPT_FROM_IMAGE_URL = `${HELIO_EDGE_ORIGIN}/api/video/api/prompt-from-image`
const VIDEO_GENERATION_URL = `${HELIO_EDGE_ORIGIN}/api/video/api/generate`

type BrandKey = 'Mansory' | 'Technogym' | 'Binghatti'
const BRAND_OPTIONS: BrandKey[] = ['Mansory', 'Technogym', 'Binghatti']

const BRAND_REFERENCE_URLS: Record<BrandKey, string[]> = {
  Mansory: [],
  Technogym: [],
  Binghatti: [],
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  videoUrl?: string
}

const LEAK = [
  'you are the dedicated',
  'primary objective',
  'execution instructions',
  'user image request',
  'output format',
  'final internal check',
  'act video rule',
]

function sanitizeErrorMessage(message: string, fallback: string): string {
  const compact = message.trim().replace(/\s+/g, ' ')
  if (!compact) return fallback
  const n = compact.toLowerCase()
  if (LEAK.some((m) => n.includes(m)) || compact.length > 420) return fallback
  return compact
}

function parseApiError(status: number, payload: string, kind: string): string {
  const fb = `${kind} failed with status ${status}.`
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

export default function HelioVideoGenFramer() {
  const [unlocked, setUnlocked] = React.useState(false)
  const [showPass, setShowPass] = React.useState(false)
  const [accessPass, setAccessPass] = React.useState('')
  const [brand, setBrand] = React.useState<BrandKey>('Mansory')
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<Message[]>([])
  const [loading, setLoading] = React.useState(false)
  const [stage, setStage] = React.useState('Generating...')
  const refCache = React.useRef<Partial<Record<BrandKey, string[]>>>({})
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const pendingTextRef = React.useRef<string | null>(null)

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

  async function deliverVideo(userRequest: string) {
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: userRequest }]
    setMessages(next)
    setLoading(true)
    const ac = new AbortController()
    const to = window.setTimeout(() => ac.abort(), 480_000)
    try {
      setStage('Generating (1/4)...')
      const r1 = await fetch(VIDEO_IMAGE_PROMPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, user_request: userRequest }),
        signal: ac.signal,
      })
      if (!r1.ok) throw new Error(parseApiError(r1.status, await r1.text(), 'Video image prompt'))
      const j1 = (await r1.json()) as { image_prompt?: string }
      const imagePrompt = (j1.image_prompt || '').trim()
      if (!imagePrompt) throw new Error('No image prompt from API.')

      setStage('Generating (2/4)...')
      const refs = await referenceDataUrls(brand)
      const r2 = await fetch(IMAGE_GENERATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          image_input: refs,
          brand,
        }),
        signal: ac.signal,
      })
      if (!r2.ok) throw new Error(parseApiError(r2.status, await r2.text(), 'Keyframe image'))
      const j2 = (await r2.json()) as { image_url?: string }
      const imageUrl = (j2.image_url || '').trim()
      if (!imageUrl) throw new Error('Image step returned no image_url.')

      setStage('Generating (3/4)...')
      const r3 = await fetch(VIDEO_PROMPT_FROM_IMAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, user_request: userRequest, image_url: imageUrl }),
        signal: ac.signal,
      })
      if (!r3.ok) throw new Error(parseApiError(r3.status, await r3.text(), 'Video prompt'))
      const j3 = (await r3.json()) as { video_prompt?: string }
      const videoPrompt = (j3.video_prompt || '').trim()
      if (!videoPrompt) throw new Error('No video prompt from API.')

      setStage('Generating (4/4)...')
      const r4 = await fetch(VIDEO_GENERATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          video_prompt: videoPrompt,
          duration: 5,
        }),
        signal: ac.signal,
      })
      if (!r4.ok) throw new Error(parseApiError(r4.status, await r4.text(), 'Video generation'))
      const j4 = (await r4.json()) as { video_url?: string }
      const videoUrl = (j4.video_url || '').trim()
      if (!videoUrl) throw new Error('Video step returned no video_url.')

      setMessages([...next, { role: 'assistant', content: 'Video generated successfully.', videoUrl }])
    } catch (e) {
      let err = 'Sorry, video generation failed. Please try again.'
      if (e instanceof Error && e.name === 'AbortError') err = 'Timed out. Try again.'
      else if (e instanceof TypeError) err = 'Network / CORS — check HELIO_EDGE_ORIGIN and console.'
      else if (e instanceof Error && e.message) err = e.message
      setMessages([...next, { role: 'assistant', content: err }])
    } finally {
      clearTimeout(to)
      setLoading(false)
      setStage('Generating...')
    }
  }

  async function onSend() {
    const text = input.trim()
    if (!text) return
    if (!unlocked) {
      pendingTextRef.current = text
      setShowPass(true)
      return
    }
    await deliverVideo(text)
  }

  function confirmPass() {
    if (accessPass !== ACCESS_PASSWORD) return
    setUnlocked(true)
    setShowPass(false)
    setAccessPass('')
    const t = pendingTextRef.current
    pendingTextRef.current = null
    if (t) void deliverVideo(t)
  }

  function cancelPass() {
    setShowPass(false)
    setAccessPass('')
    pendingTextRef.current = null
  }

  const box: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 480,
    border: '1px solid #e5e5e5',
    borderRadius: 16,
    background: '#fff',
    overflow: 'hidden',
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
        {messages.length === 0 ? (
          <p style={{ color: '#737373', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Welcome to Video Generator. Choose a brand, describe the video you want below, then send.
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
                lineHeight: 1.5,
                background: m.role === 'user' ? '#171717' : '#f5f5f5',
                color: m.role === 'user' ? '#fff' : '#262626',
                borderTopRightRadius: m.role === 'user' ? 4 : 16,
                borderTopLeftRadius: m.role === 'assistant' ? 4 : 16,
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              {m.videoUrl ? (
                <div style={{ marginTop: 14 }}>
                  <video
                    src={m.videoUrl}
                    controls
                    style={{ width: '100%', borderRadius: 12, border: '1px solid #e5e5e5' }}
                  />
                  <a
                    href={m.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: ACCENT_ON_LIGHT }}
                  >
                    Open video
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
            placeholder="Describe the video you want..."
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
