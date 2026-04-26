"""Storyteller OpenRouter wrapper.

Thin shim over :mod:`agent_common.openrouter`. Storyteller is a chat
agent, so it uses the fallback-aware variant: on a 429/upstream error it
drops to the next model in ``STORYTELLER_FALLBACK_MODELS``.
"""

from __future__ import annotations

from agent_common import openrouter as _shared


def openrouter_chat_with_fallbacks(
    messages: list[dict],
    *,
    max_tokens: int = 900,
    temperature: float = 0.7,
    service_title: str = 'Helio Storyteller',
) -> str:
    return _shared.openrouter_chat_with_fallbacks(
        messages,
        model_env='STORYTELLER_LLM_MODEL',
        fallback_env='STORYTELLER_FALLBACK_MODELS',
        max_tokens=max_tokens,
        temperature=temperature,
        service_title=service_title,
    )
