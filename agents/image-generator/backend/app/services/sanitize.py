"""Image-generator prompt-leak sanitizer.

Holds the agent-specific marker list and forwards to the shared sanitizer
in :mod:`agent_common.sanitize`.
"""

from __future__ import annotations

from agent_common.sanitize import (
    looks_like_prompt_dump as _shared_looks_like_prompt_dump,
    sanitize_provider_message as _shared_sanitize,
)

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


def looks_like_prompt_dump(text: str) -> bool:
    return _shared_looks_like_prompt_dump(text, markers=PROMPT_LEAK_MARKERS)


def sanitize_provider_message(message: str, fallback: str) -> str:
    return _shared_sanitize(message, fallback, markers=PROMPT_LEAK_MARKERS)
