"""Replicate API client for image generation (Seedream)."""

from __future__ import annotations

import logging
import os
import time

from app.services.http_client import json_request

logger = logging.getLogger(__name__)

REPLICATE_API_BASE = 'https://api.replicate.com/v1'
REPLICATE_DEFAULT_MODEL = 'bytedance/seedream-4.5'
REPLICATE_POLL_INTERVAL_SECONDS = 1.5
REPLICATE_MAX_POLLS = 80


def get_replicate_token() -> str:
    return (
        os.getenv('REPLICATE_API_TOKEN')
        or os.getenv('VITE_REPLICATE_API_TOKEN')
        or ''
    ).strip()


def get_replicate_model() -> str:
    return (
        os.getenv('REPLICATE_IMAGE_MODEL')
        or os.getenv('VITE_REPLICATE_IMAGE_MODEL')
        or REPLICATE_DEFAULT_MODEL
    ).strip() or REPLICATE_DEFAULT_MODEL


def _extract_image_url(output: object) -> str:
    if isinstance(output, str) and output.startswith('http'):
        return output
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and item.startswith('http'):
                return item
    return ''


def run_image_prediction(*, prompt: str, image_input: list[str]) -> tuple[str, str]:
    """Return (prediction_id, image_url) or raise RuntimeError."""

    token = get_replicate_token()
    if not token:
        raise RuntimeError('REPLICATE_API_TOKEN is not configured on backend.')

    model = get_replicate_model()
    predictions_url = f'{REPLICATE_API_BASE}/models/{model}/predictions'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    payload = {
        'input': {
            'prompt': prompt,
            'image_input': image_input,
            'aspect_ratio': '16:9',
            'max_images': 1,
            'sequential_image_generation': 'disabled',
        },
    }

    prediction = json_request('POST', predictions_url, headers, payload)
    status_value = str(prediction.get('status') or '').lower()
    get_url = ((prediction.get('urls') or {}).get('get') or '').strip()

    poll_count = 0
    while status_value in {'starting', 'processing'} and get_url and poll_count < REPLICATE_MAX_POLLS:
        poll_count += 1
        time.sleep(REPLICATE_POLL_INTERVAL_SECONDS)
        prediction = json_request('GET', get_url, headers)
        status_value = str(prediction.get('status') or '').lower()

    if status_value not in {'succeeded', 'failed', 'canceled'}:
        raise RuntimeError('Replicate timed out before returning final output.')

    if status_value in {'failed', 'canceled'}:
        raise RuntimeError(
            prediction.get('error')
            or prediction.get('detail')
            or f'Replicate generation {status_value}.'
        )

    image_url = _extract_image_url(prediction.get('output'))
    if not image_url:
        raise RuntimeError('Replicate succeeded but no image URL was returned.')

    return str(prediction.get('id') or ''), image_url
