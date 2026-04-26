"""Image-generator OpenRouter wrapper.

Thin shim over :mod:`agent_common.openrouter` that pre-binds the model
env-var (``IMAGE_PROMPT_LLM_MODEL``) and a sensible default service title
so the rest of the agent can keep calling ``openrouter_chat(...)`` exactly
as before.
"""

from __future__ import annotations

from agent_common import openrouter as _shared


def openrouter_chat(
    messages: list[dict],
    *,
    max_tokens: int = 420,
    temperature: float = 0.45,
    service_title: str = 'Helio Image Generator',
) -> str:
    return _shared.openrouter_chat(
        messages,
        model_env='IMAGE_PROMPT_LLM_MODEL',
        max_tokens=max_tokens,
        temperature=temperature,
        service_title=service_title,
    )
