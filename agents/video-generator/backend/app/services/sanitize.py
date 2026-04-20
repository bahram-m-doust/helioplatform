"""Guards against leaked system prompts and provider secrets in LLM output."""

from __future__ import annotations

PROMPT_LEAK_MARKERS = (
    'you are a cinematic image prompt engineer',
    'you are a vision-to-kling prompt compiler',
    'you are the dedicated',
    'primary objective',
    'brand essence',
    'scene expansion rule',
    'output format',
    'execution instructions',
    'user image request',
    'final internal check',
    'return exactly one final english image prompt',
    'mission',
    'act video rule',
    'prompt construction order',
)

PROVIDER_SECRET_MARKERS = (
    'seedream',
    'kling',
    'openai/gpt-4o',
    'bytedance',
    'kwaivgi',
    'replicate.com',
)


def looks_like_instruction_dump(text: str) -> bool:
    normalized = (text or '').strip().lower()
    if not normalized:
        return False
    marker_hits = sum(1 for marker in PROMPT_LEAK_MARKERS if marker in normalized)
    line_count = sum(1 for line in normalized.splitlines() if line.strip())
    return marker_hits >= 2 or (len(normalized) > 950 and line_count > 10)


def sanitize_provider_message(message: str, fallback: str) -> str:
    compact = ' '.join((message or '').split()).strip()
    if not compact:
        return fallback
    normalized = compact.lower()
    if looks_like_instruction_dump(compact) or len(compact) > 420:
        return fallback
    if any(marker in normalized for marker in PROVIDER_SECRET_MARKERS):
        return fallback
    return compact
