const env = (import.meta as any).env ?? {};

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
const defaultCommunityUrl = isLocalHost ? 'http://localhost:5050' : '/community';
const defaultApiHost = hostname || 'localhost';
const defaultHeliogramApiBaseUrl = `http://${defaultApiHost}:8010`;

const trimTrailingSlash = (value: string): string => value.trim().replace(/\/+$/, '');
const joinApiPath = (baseUrl: string, path: string): string =>
  `${trimTrailingSlash(baseUrl)}/${path.replace(/^\/+/, '')}`;

export const OPENROUTER_API_KEY: string = env.VITE_OPENROUTER_API_KEY?.trim() ?? '';
export const OPENROUTER_MODEL: string =
  env.VITE_OPENROUTER_MODEL?.trim() || 'openai/gpt-4o';
const fallbackModels = (env.VITE_OPENROUTER_FALLBACK_MODELS?.trim() || '')
  .split(',')
  .map((model: string) => model.trim())
  .filter(Boolean);
export const OPENROUTER_FALLBACK_MODELS: string[] = fallbackModels.filter(
  (model: string) => model !== OPENROUTER_MODEL,
);
export const COMMUNITY_URL: string = env.VITE_COMMUNITY_URL?.trim() || defaultCommunityUrl;
export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Always derive backend URLs from one base to avoid LAN/IP hostname mismatches.
export const HELIOGRAM_API_BASE_URL: string =
  trimTrailingSlash(env.VITE_HELIOGRAM_API_BASE_URL?.trim() || defaultHeliogramApiBaseUrl);

export const IMAGE_PROMPT_API_URL: string =
  env.VITE_IMAGE_PROMPT_API_URL?.trim() || joinApiPath(HELIOGRAM_API_BASE_URL, '/api/ai/image/prompt/');
export const IMAGE_GENERATION_API_URL: string =
  env.VITE_IMAGE_GENERATION_API_URL?.trim() ||
  joinApiPath(HELIOGRAM_API_BASE_URL, '/api/ai/image/generate/');
export const VIDEO_IMAGE_PROMPT_API_URL: string =
  env.VITE_VIDEO_IMAGE_PROMPT_API_URL?.trim() ||
  joinApiPath(HELIOGRAM_API_BASE_URL, '/api/ai/video/image-prompt/');
export const VIDEO_PROMPT_FROM_IMAGE_API_URL: string =
  env.VITE_VIDEO_PROMPT_FROM_IMAGE_API_URL?.trim() ||
  joinApiPath(HELIOGRAM_API_BASE_URL, '/api/ai/video/prompt-from-image/');
export const VIDEO_GENERATION_API_URL: string =
  env.VITE_VIDEO_GENERATION_API_URL?.trim() ||
  joinApiPath(HELIOGRAM_API_BASE_URL, '/api/ai/video/generate/');
