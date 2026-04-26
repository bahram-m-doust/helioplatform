"""Guards against leaked system prompts and provider secrets in LLM output.

Each agent owns its prompt-leak marker list (the strings that, if echoed
back from the model, mean the system prompt has bled into the response).
The marker list is passed in by the caller; the detection logic and the
provider-secret list are shared.
"""

from __future__ import annotations

PROVIDER_SECRET_MARKERS = (
    'seedream',
    'kling',
    'openai/gpt-4o',
    'bytedance',
    'kwaivgi',
    'replicate.com',
)


def looks_like_prompt_dump(
    text: str,
    *,
    markers: tuple[str, ...],
    long_text_threshold: int = 900,
    long_line_threshold: int = 10,
) -> bool:
    """``True`` if ``text`` looks like a leaked system-prompt dump.

    Triggers when ≥2 markers appear, OR when the response is unusually long
    (>``long_text_threshold`` chars) AND has many lines (>``long_line_threshold``).
    """
    normalized = (text or '').strip().lower()
    if not normalized:
        return False
    marker_hits = sum(1 for marker in markers if marker in normalized)
    line_count = sum(1 for line in normalized.splitlines() if line.strip())
    return marker_hits >= 2 or (
        len(normalized) > long_text_threshold and line_count > long_line_threshold
    )


def sanitize_provider_message(
    message: str,
    fallback: str,
    *,
    markers: tuple[str, ...] = (),
    long_text_threshold: int = 900,
    long_line_threshold: int = 10,
) -> str:
    """Return ``message`` if it's safe to surface, else ``fallback``.

    Replaces messages that look like a prompt dump, are unusually long
    (>420 chars), or contain provider-secret strings.
    """
    compact = ' '.join((message or '').split()).strip()
    if not compact:
        return fallback
    normalized = compact.lower()
    if markers and looks_like_prompt_dump(
        compact,
        markers=markers,
        long_text_threshold=long_text_threshold,
        long_line_threshold=long_line_threshold,
    ):
        return fallback
    if len(compact) > 420:
        return fallback
    if any(marker in normalized for marker in PROVIDER_SECRET_MARKERS):
        return fallback
    return compact
