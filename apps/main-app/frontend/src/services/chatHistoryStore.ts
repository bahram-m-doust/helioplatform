const STORAGE_ROOT = 'helio.chat-history';
const GUEST_USERNAME = 'guest';

export interface StoredChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getKey = (agentId: string, username: string | null | undefined): string => {
  const safeUsername = username && username.trim().length > 0 ? username.trim() : GUEST_USERNAME;
  return `${STORAGE_ROOT}.${agentId}.${safeUsername}`;
};

export function loadChatHistory(
  agentId: string,
  username: string | null,
): StoredChatMessage[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(getKey(agentId, username));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is StoredChatMessage =>
        entry &&
        typeof entry === 'object' &&
        (entry.role === 'user' || entry.role === 'assistant' || entry.role === 'system') &&
        typeof entry.content === 'string',
    );
  } catch {
    return [];
  }
}

export function saveChatHistory(
  agentId: string,
  username: string | null,
  messages: StoredChatMessage[],
): void {
  if (!canUseStorage()) return;
  try {
    const payload = messages.map((m) => ({ role: m.role, content: m.content }));
    window.localStorage.setItem(getKey(agentId, username), JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

export function clearChatHistory(agentId: string, username: string | null): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(getKey(agentId, username));
  } catch {
    /* noop */
  }
}
