"""OpenRouter chat client used by every agent.

Two entry points:

* ``openrouter_chat`` — single-call, no model fallback. Used by image- and
  video-generator agents where prompt building is one-shot.
* ``openrouter_chat_with_fallbacks`` — primary model + ordered fallback list.
  Used by chat-style agents (storyteller, campaign-maker) where a 429 with
  upstream / rate-limit markers should drop to the next model instead of
  bubbling the failure to the caller.

Per-agent configuration (model env-var name, fallback env-var name, service
title) is passed in by the caller so this module stays agent-agnostic.
"""

from __future__ import annotations

import logging
import os

from agent_common.http_client import json_request

logger = logging.getLogger(__name__)

OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o'

_FALLBACK_RETRY_MARKERS = (
    'rate-limit',
    'rate limited',
    'temporarily rate-limited',
    'upstream',
    'no healthy upstream',
)


def get_openrouter_token() -> str:
    return (os.getenv('OPENROUTER_API_KEY') or '').strip()


def resolve_model(env_var: str) -> str:
    """Resolve the primary model: per-agent override → shared default."""
    return (
        os.getenv(env_var)
        or os.getenv('OPENROUTER_MODEL')
        or DEFAULT_OPENROUTER_MODEL
    ).strip() or DEFAULT_OPENROUTER_MODEL


def resolve_fallbacks(env_var: str, primary: str) -> list[str]:
    raw = os.getenv(env_var) or os.getenv('OPENROUTER_FALLBACK_MODELS') or ''
    return [
        item.strip()
        for item in raw.split(',')
        if item.strip() and item.strip() != primary
    ]


def _extract_content(response_data: dict) -> str:
    choices = response_data.get('choices') or []
    if not choices:
        return ''

    message = (choices[0] or {}).get('message') or {}
    content = message.get('content')
    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
                continue
            if isinstance(item, dict):
                text = item.get('text')
                if isinstance(text, str):
                    parts.append(text)
        return '\n'.join(part.strip() for part in parts if part and part.strip()).strip()

    return ''


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith('```') and cleaned.endswith('```'):
        lines = cleaned.splitlines()
        if len(lines) >= 2:
            cleaned = '\n'.join(lines[1:-1]).strip()
    return cleaned


def _build_headers(token: str, service_title: str) -> dict:
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'HTTP-Referer': os.getenv('FRONTEND_URL', 'http://localhost:4000'),
        'X-OpenRouter-Title': service_title,
    }


def openrouter_chat(
    messages: list[dict],
    *,
    model_env: str,
    max_tokens: int = 420,
    temperature: float = 0.45,
    service_title: str = 'Helio Agent',
) -> str:
    """Single-shot OpenRouter call. Raises ``RuntimeError`` on any failure."""
    token = get_openrouter_token()
    if not token:
        raise RuntimeError('OPENROUTER_API_KEY is not configured on backend.')

    payload = {
        'model': resolve_model(model_env),
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': temperature,
    }
    response_data = json_request(
        'POST', OPENROUTER_CHAT_URL, _build_headers(token, service_title), payload,
    )
    content = _extract_content(response_data)
    if not content:
        raise RuntimeError('OpenRouter returned empty content.')
    return _strip_code_fences(content)


def _is_fallback_worthy(error_message: str) -> bool:
    normalized = (error_message or '').lower()
    if not normalized:
        return False
    return any(marker in normalized for marker in _FALLBACK_RETRY_MARKERS)


def openrouter_chat_with_fallbacks(
    messages: list[dict],
    *,
    model_env: str,
    fallback_env: str,
    max_tokens: int = 900,
    temperature: float = 0.7,
    service_title: str = 'Helio Agent',
) -> str:
    """Primary model + ordered fallback list. Falls through on rate-limit / upstream errors."""
    token = get_openrouter_token()
    if not token:
        raise RuntimeError('OPENROUTER_API_KEY is not configured on backend.')

    primary = resolve_model(model_env)
    models_to_try = [primary, *resolve_fallbacks(fallback_env, primary)]
    headers = _build_headers(token, service_title)

    last_error: Exception | None = None
    for index, model_id in enumerate(models_to_try):
        payload = {
            'model': model_id,
            'messages': messages,
            'max_tokens': max_tokens,
            'temperature': temperature,
        }
        try:
            response_data = json_request('POST', OPENROUTER_CHAT_URL, headers, payload)
        except RuntimeError as runtime_error:
            last_error = runtime_error
            if index < len(models_to_try) - 1 and _is_fallback_worthy(str(runtime_error)):
                logger.warning('Model %s failed (%s). Trying fallback.', model_id, runtime_error)
                continue
            raise

        content = _extract_content(response_data)
        if content:
            return content

        last_error = RuntimeError('OpenRouter returned empty content.')
        if index == len(models_to_try) - 1:
            raise last_error

    if last_error:
        raise last_error
    raise RuntimeError('No model returned a response.')
