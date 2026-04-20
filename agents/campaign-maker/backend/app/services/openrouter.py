"""OpenRouter chat client for the Campaign Maker agent.

Supports a primary model plus a list of fallback models. On a 429 with
upstream/rate-limit markers we try the next model in order.
"""

from __future__ import annotations

import logging
import os

from app.services.http_client import json_request

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
    return (
        os.getenv('OPENROUTER_API_KEY')
        or os.getenv('VITE_OPENROUTER_API_KEY')
        or ''
    ).strip()


def get_openrouter_model() -> str:
    return (
        os.getenv('CAMPAIGN_MAKER_LLM_MODEL')
        or os.getenv('OPENROUTER_MODEL')
        or os.getenv('VITE_OPENROUTER_MODEL')
        or DEFAULT_OPENROUTER_MODEL
    ).strip() or DEFAULT_OPENROUTER_MODEL


def get_openrouter_fallback_models() -> list[str]:
    raw = (
        os.getenv('CAMPAIGN_MAKER_FALLBACK_MODELS')
        or os.getenv('OPENROUTER_FALLBACK_MODELS')
        or os.getenv('VITE_OPENROUTER_FALLBACK_MODELS')
        or ''
    )
    primary = get_openrouter_model()
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


def _is_fallback_worthy(error_message: str) -> bool:
    normalized = (error_message or '').lower()
    if not normalized:
        return False
    return any(marker in normalized for marker in _FALLBACK_RETRY_MARKERS)


def openrouter_chat_with_fallbacks(
    messages: list[dict],
    *,
    max_tokens: int = 900,
    temperature: float = 0.7,
    service_title: str = 'Helio Campaign Maker',
) -> str:
    token = get_openrouter_token()
    if not token:
        raise RuntimeError('OPENROUTER_API_KEY is not configured on backend.')

    models_to_try = [get_openrouter_model(), *get_openrouter_fallback_models()]
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'HTTP-Referer': os.getenv('FRONTEND_URL', 'http://localhost:4000'),
        'X-OpenRouter-Title': service_title,
    }

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
                logger.warning(
                    'Model %s failed (%s). Trying fallback.', model_id, runtime_error,
                )
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
