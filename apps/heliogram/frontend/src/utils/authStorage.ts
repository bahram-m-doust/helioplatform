// Session-aware token storage.
// Invariant: token keys are namespaced by `?session=<key>` so two users can
// stay logged in simultaneously on the same browser/origin without collisions.
//
const DEFAULT_SESSION_KEY = 'default'
const SESSION_QUERY_PARAM = 'session'

const CURRENT_PREFIX = 'heliogram'

const SESSION_STORAGE_KEY = 'heliogram_session_key'

type TokenName = 'access_token' | 'refresh_token'

function normalizeSessionKey(raw: string): string {
  const normalized = raw.trim().replace(/[^a-zA-Z0-9._@+-]/g, '-')
  return normalized || DEFAULT_SESSION_KEY
}

function readSessionFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get(SESSION_QUERY_PARAM)
  if (!value || !value.trim()) return null
  return normalizeSessionKey(value)
}

function readStoredSession(): string | null {
  if (typeof window === 'undefined') return null

  const current = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (current && current.trim()) {
    return normalizeSessionKey(current)
  }
  return null
}

function storeSession(sessionKey: string): string {
  const normalized = normalizeSessionKey(sessionKey)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_STORAGE_KEY, normalized)
  }
  return normalized
}

function replaceUrlSession(sessionKey: string): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeSessionKey(sessionKey)
  const url = new URL(window.location.href)
  const current = url.searchParams.get(SESSION_QUERY_PARAM)
  if (current === normalized) return
  url.searchParams.set(SESSION_QUERY_PARAM, normalized)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

function resolveSessionKey(): string {
  // Priority order keeps tab identity deterministic:
  // URL -> tab sessionStorage -> default.
  const urlSession = readSessionFromUrl()
  if (urlSession) {
    return storeSession(urlSession)
  }

  const storedSession = readStoredSession()
  if (storedSession) return storedSession

  return DEFAULT_SESSION_KEY
}

function keyForPrefix(prefix: string, name: TokenName, sessionKey: string): string {
  return `${prefix}:${normalizeSessionKey(sessionKey)}:${name}`
}

function key(name: TokenName): string {
  return keyForPrefix(CURRENT_PREFIX, name, resolveSessionKey())
}

function readTokenWithFallback(name: TokenName, sessionKey: string): string | null {
  const currentKey = keyForPrefix(CURRENT_PREFIX, name, sessionKey)
  const currentValue = localStorage.getItem(currentKey)
  if (currentValue) return currentValue
  return null
}

function keyForSession(name: TokenName, sessionKey: string): string {
  return keyForPrefix(CURRENT_PREFIX, name, sessionKey)
}

export const authStorage = {
  setSessionFromUsername(username: string): string {
    // Login path: bind tab namespace to username and sync URL.
    const sessionKey = storeSession(username)
    replaceUrlSession(sessionKey)
    return sessionKey
  },

  syncUrlWithStoredSession(): void {
    const urlSession = readSessionFromUrl()
    if (urlSession) {
      storeSession(urlSession)
      return
    }
    const stored = readStoredSession()
    if (stored) {
      replaceUrlSession(stored)
    }
  },

  bindSessionToUsername(username: string): string {
    // After login bootstrap, migrate tokens from provisional namespace
    // to canonical username namespace confirmed by backend identity.
    const currentSession = resolveSessionKey()
    const targetSession = storeSession(username)

    const tokenNames: TokenName[] = ['access_token', 'refresh_token']

    tokenNames.forEach((name) => {
      const targetKey = keyForPrefix(CURRENT_PREFIX, name, targetSession)
      const sourceKey = keyForPrefix(CURRENT_PREFIX, name, currentSession)
      const value = localStorage.getItem(sourceKey)
      if (!value) return
      if (!localStorage.getItem(targetKey)) {
        localStorage.setItem(targetKey, value)
      }
      localStorage.removeItem(sourceKey)
    })

    replaceUrlSession(targetSession)
    return targetSession
  },

  getAccessToken(): string | null {
    return readTokenWithFallback('access_token', resolveSessionKey())
  },

  setAccessToken(token: string): void {
    localStorage.setItem(key('access_token'), token)
  },

  getRefreshToken(): string | null {
    return readTokenWithFallback('refresh_token', resolveSessionKey())
  },

  setRefreshToken(token: string): void {
    localStorage.setItem(key('refresh_token'), token)
  },

  clearTokens(): void {
    const sessionKey = resolveSessionKey()
    localStorage.removeItem(keyForPrefix(CURRENT_PREFIX, 'access_token', sessionKey))
    localStorage.removeItem(keyForPrefix(CURRENT_PREFIX, 'refresh_token', sessionKey))
  },

  hasAccessToken(): boolean {
    return !!this.getAccessToken()
  },

  getSessionKeyForDebug(): string {
    return resolveSessionKey()
  },
}
