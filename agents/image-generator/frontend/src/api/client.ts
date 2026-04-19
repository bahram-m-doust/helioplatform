const base = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

/** Build an absolute URL for same-origin `/api` in dev (Vite proxy) or a configured backend base. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalized;
  }
  return `${base.replace(/\/$/, '')}${normalized}`;
}
