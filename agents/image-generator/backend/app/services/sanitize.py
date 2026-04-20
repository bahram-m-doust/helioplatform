"""Guards against leaked system prompts and provider secrets in LLM output."""

from __future__ import annotations

PROMPT_LEAK_MARKERS = (
    'you are a subject-first visual prompt architect',
    'you are the dedicated',
    'primary objective',
    'brand essence',
    'hard rules:',
    'execution instructions',
    'user image request',
    'output format',
    'final internal check',
    'scene type routing',
    'prompt construction order',
    'system prompt',
)

PROVIDER_SECRET_MARKERS = (
    'seedream',
    'kling',
    'openai/gpt-4o',
    'bytedance',
    'kwaivgi',
    'replicate.com',
)


def looks_like_prompt_dump(text: str) -> bool:
    normalized = (text or '').strip().lower()
    if not normalized:
        return False
    marker_hits = sum(1 for marker in PROMPT_LEAK_MARKERS if marker in normalized)
    line_count = sum(1 for line in normalized.splitlines() if line.strip())
    return marker_hits >= 2 or (len(normalized) > 900 and line_count > 10)


def sanitize_provider_message(message: str, fallback: str) -> str:
    compact = ' '.join((message or '').split()).strip()
    if not compact:
        return fallback
    normalized = compact.lower()
    if looks_like_prompt_dump(compact) or len(compact) > 420:
        return fallback
    if any(marker in normalized for marker in PROVIDER_SECRET_MARKERS):
        return fallback
    return compact
