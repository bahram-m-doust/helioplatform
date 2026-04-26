"""Video-generator OpenRouter wrapper.

Thin shim over :mod:`agent_common.openrouter` that pre-binds the model
env-var (``VIDEO_PROMPT_LLM_MODEL``) and a sensible default service title.
"""

from __future__ import annotations

from agent_common import openrouter as _shared


def openrouter_chat(
    messages: list[dict],
    *,
    max_tokens: int = 600,
    temperature: float = 0.35,
    service_title: str = 'Helio Video Generator',
) -> str:
    return _shared.openrouter_chat(
        messages,
        model_env='VIDEO_PROMPT_LLM_MODEL',
        max_tokens=max_tokens,
        temperature=temperature,
        service_title=service_title,
    )
