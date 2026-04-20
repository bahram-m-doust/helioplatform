const env = (import.meta as any).env ?? {};

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
const defaultCommunityUrl = isLocalHost ? 'http://localhost:5050' : '/community';
const defaultApiHost = hostname || 'localhost';

// Heliogram (social platform) backend — identity/auth/messaging.
const defaultHeliogramApiBaseUrl = `http://${defaultApiHost}:8010`;

// Each AI agent is its own microservice.
// Image generator: port 8020. Video generator: port 8030. Storyteller: 8040.
const defaultImageAgentBaseUrl = `http://${defaultApiHost}:8020`;
const defaultVideoAgentBaseUrl = `http://${defaultApiHost}:8030`;
const defaultStorytellerAgentBaseUrl = `http://${defaultApiHost}:8040`;
const defaultCampaignMakerAgentBaseUrl = `http://${defaultApiHost}:8050`;

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

export const HELIOGRAM_API_BASE_URL: string =
  trimTrailingSlash(env.VITE_HELIOGRAM_API_BASE_URL?.trim() || defaultHeliogramApiBaseUrl);

export const IMAGE_AGENT_API_BASE_URL: string =
  trimTrailingSlash(env.VITE_IMAGE_AGENT_API_BASE_URL?.trim() || defaultImageAgentBaseUrl);
export const VIDEO_AGENT_API_BASE_URL: string =
  trimTrailingSlash(env.VITE_VIDEO_AGENT_API_BASE_URL?.trim() || defaultVideoAgentBaseUrl);
export const STORYTELLER_AGENT_API_BASE_URL: string =
  trimTrailingSlash(
    env.VITE_STORYTELLER_AGENT_API_BASE_URL?.trim() || defaultStorytellerAgentBaseUrl,
  );
export const CAMPAIGN_MAKER_AGENT_API_BASE_URL: string =
  trimTrailingSlash(
    env.VITE_CAMPAIGN_MAKER_AGENT_API_BASE_URL?.trim() || defaultCampaignMakerAgentBaseUrl,
  );

export const STORYTELLER_CHAT_API_URL: string =
  env.VITE_STORYTELLER_CHAT_API_URL?.trim() ||
  joinApiPath(STORYTELLER_AGENT_API_BASE_URL, '/api/chat');
export const CAMPAIGN_MAKER_CHAT_API_URL: string =
  env.VITE_CAMPAIGN_MAKER_CHAT_API_URL?.trim() ||
  joinApiPath(CAMPAIGN_MAKER_AGENT_API_BASE_URL, '/api/chat');

export const IMAGE_PROMPT_API_URL: string =
  env.VITE_IMAGE_PROMPT_API_URL?.trim() || joinApiPath(IMAGE_AGENT_API_BASE_URL, '/api/prompt');
export const IMAGE_GENERATION_API_URL: string =
  env.VITE_IMAGE_GENERATION_API_URL?.trim() ||
  joinApiPath(IMAGE_AGENT_API_BASE_URL, '/api/generate');
export const VIDEO_IMAGE_PROMPT_API_URL: string =
  env.VITE_VIDEO_IMAGE_PROMPT_API_URL?.trim() ||
  joinApiPath(VIDEO_AGENT_API_BASE_URL, '/api/image-prompt');
export const VIDEO_PROMPT_FROM_IMAGE_API_URL: string =
  env.VITE_VIDEO_PROMPT_FROM_IMAGE_API_URL?.trim() ||
  joinApiPath(VIDEO_AGENT_API_BASE_URL, '/api/prompt-from-image');
export const VIDEO_GENERATION_API_URL: string =
  env.VITE_VIDEO_GENERATION_API_URL?.trim() ||
  joinApiPath(VIDEO_AGENT_API_BASE_URL, '/api/generate');
