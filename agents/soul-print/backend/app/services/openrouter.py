"""Soul-print OpenRouter wrapper.

Pre-binds the model env-var (``SOUL_PRINT_LLM_MODEL`` / falls back to
shared ``OPENROUTER_MODEL``) and a sensible default service title.
Uses the fallback-aware variant — soul-print conversations are long,
so a flaky model should drop to the next one in the list rather than
crashing the session.
"""

from __future__ import annotations

from agent_common import openrouter as _shared


def openrouter_chat_with_fallbacks(
    messages: list[dict],
    *,
    max_tokens: int = 1200,
    temperature: float = 0.65,
    service_title: str = "Helio Soul Print",
) -> str:
    return _shared.openrouter_chat_with_fallbacks(
        messages,
        model_env="SOUL_PRINT_LLM_MODEL",
        fallback_env="SOUL_PRINT_FALLBACK_MODELS",
        max_tokens=max_tokens,
        temperature=temperature,
        service_title=service_title,
    )
