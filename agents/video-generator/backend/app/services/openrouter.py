"""OpenRouter chat client for the video agent."""

from __future__ import annotations

import logging
import os

from app.services.http_client import json_request

logger = logging.getLogger(__name__)

OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o'


def get_openrouter_token() -> str:
    return (
        os.getenv('OPENROUTER_API_KEY')
        or os.getenv('VITE_OPENROUTER_API_KEY')
        or ''
    ).strip()


def get_openrouter_model() -> str:
    return (
        os.getenv('VIDEO_PROMPT_LLM_MODEL')
        or os.getenv('OPENROUTER_MODEL')
        or os.getenv('VITE_OPENROUTER_MODEL')
        or DEFAULT_OPENROUTER_MODEL
    ).strip() or DEFAULT_OPENROUTER_MODEL


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


def openrouter_chat(
    messages: list[dict],
    *,
    max_tokens: int = 700,
    temperature: float = 0.4,
) -> str:
    token = get_openrouter_token()
    if not token:
        raise RuntimeError('OPENROUTER_API_KEY is not configured on backend.')

    model = get_openrouter_model()
    payload = {
        'model': model,
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': temperature,
    }
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'HTTP-Referer': os.getenv('FRONTEND_URL', 'http://localhost:4000'),
        'X-OpenRouter-Title': 'Helio Video Generator',
    }
    data = json_request('POST', OPENROUTER_CHAT_URL, headers, payload)
    content = _extract_content(data)
    if not content:
        raise RuntimeError('OpenRouter returned empty content.')
    return _strip_code_fences(content)
