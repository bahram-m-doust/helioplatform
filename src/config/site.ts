const env = (import.meta as any).env ?? {};

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
const defaultCommunityUrl = isLocalHost ? 'http://localhost:5050' : '/community';
const defaultImagePromptApiUrl = isLocalHost
  ? 'http://localhost:8010/api/ai/image/prompt/'
  : '/api/ai/image/prompt/';
const defaultImageGenerationApiUrl = isLocalHost
  ? 'http://localhost:8010/api/ai/image/generate/'
  : '/api/ai/image/generate/';
const defaultVideoImagePromptApiUrl = isLocalHost
  ? 'http://localhost:8010/api/ai/video/image-prompt/'
  : '/api/ai/video/image-prompt/';
const defaultVideoPromptFromImageApiUrl = isLocalHost
  ? 'http://localhost:8010/api/ai/video/prompt-from-image/'
  : '/api/ai/video/prompt-from-image/';
const defaultVideoGenerationApiUrl = isLocalHost
  ? 'http://localhost:8010/api/ai/video/generate/'
  : '/api/ai/video/generate/';

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
export const IMAGE_PROMPT_API_URL: string =
  env.VITE_IMAGE_PROMPT_API_URL?.trim() || defaultImagePromptApiUrl;
export const IMAGE_GENERATION_API_URL: string =
  env.VITE_IMAGE_GENERATION_API_URL?.trim() || defaultImageGenerationApiUrl;
export const VIDEO_IMAGE_PROMPT_API_URL: string =
  env.VITE_VIDEO_IMAGE_PROMPT_API_URL?.trim() || defaultVideoImagePromptApiUrl;
export const VIDEO_PROMPT_FROM_IMAGE_API_URL: string =
  env.VITE_VIDEO_PROMPT_FROM_IMAGE_API_URL?.trim() || defaultVideoPromptFromImageApiUrl;
export const VIDEO_GENERATION_API_URL: string =
  env.VITE_VIDEO_GENERATION_API_URL?.trim() || defaultVideoGenerationApiUrl;
