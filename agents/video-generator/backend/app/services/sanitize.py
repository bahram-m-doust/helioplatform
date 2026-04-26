"""Video-generator prompt-leak sanitizer.

Holds the agent-specific marker list and forwards to the shared sanitizer
in :mod:`agent_common.sanitize`. Keeps the legacy
``looks_like_instruction_dump`` name as an alias of the shared
``looks_like_prompt_dump`` so existing routes do not break.
"""

from __future__ import annotations

from agent_common.sanitize import (
    looks_like_prompt_dump as _shared_looks_like_prompt_dump,
    sanitize_provider_message as _shared_sanitize,
)

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

# Video has a slightly looser long-text threshold than the image agent.
_LONG_TEXT_THRESHOLD = 950


def looks_like_instruction_dump(text: str) -> bool:
    return _shared_looks_like_prompt_dump(
        text,
        markers=PROMPT_LEAK_MARKERS,
        long_text_threshold=_LONG_TEXT_THRESHOLD,
    )


def sanitize_provider_message(message: str, fallback: str) -> str:
    return _shared_sanitize(
        message,
        fallback,
        markers=PROMPT_LEAK_MARKERS,
        long_text_threshold=_LONG_TEXT_THRESHOLD,
    )
