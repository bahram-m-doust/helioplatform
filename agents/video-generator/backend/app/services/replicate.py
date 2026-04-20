"""Replicate API client for video generation (Kling)."""

from __future__ import annotations

import logging
import os
import time

from app.services.http_client import json_request

logger = logging.getLogger(__name__)

REPLICATE_API_BASE = 'https://api.replicate.com/v1'
DEFAULT_REPLICATE_VIDEO_MODEL = 'kwaivgi/kling-v2.5-turbo-pro'
REPLICATE_POLL_INTERVAL_SECONDS = 1.5
REPLICATE_MAX_POLLS = 120


def get_replicate_token() -> str:
    return (
        os.getenv('REPLICATE_API_TOKEN')
        or os.getenv('VITE_REPLICATE_API_TOKEN')
        or ''
    ).strip()


def get_replicate_video_model() -> str:
    model = (
        os.getenv('REPLICATE_VIDEO_MODEL')
        or os.getenv('VITE_REPLICATE_VIDEO_MODEL')
        or DEFAULT_REPLICATE_VIDEO_MODEL
    ).strip() or DEFAULT_REPLICATE_VIDEO_MODEL

    if model == 'kwaivgi/kling-v2.1-master':
        return DEFAULT_REPLICATE_VIDEO_MODEL
    return model


def _poll_prediction(get_url: str, headers: dict) -> dict:
    poll_count = 0
    prediction: dict = {}
    status_value = 'starting'

    while status_value in {'starting', 'processing'} and poll_count < REPLICATE_MAX_POLLS:
        poll_count += 1
        time.sleep(REPLICATE_POLL_INTERVAL_SECONDS)
        prediction = json_request('GET', get_url, headers)
        status_value = str(prediction.get('status') or '').lower()

    return prediction


def _extract_video_url(output: object) -> str:
    if isinstance(output, str) and output.startswith('http'):
        return output
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and item.startswith('http'):
                return item
    return ''


def run_video_prediction(*, prompt: str, image_url: str, duration: int) -> tuple[str, str]:
    token = get_replicate_token()
    if not token:
        raise RuntimeError('REPLICATE_API_TOKEN is not configured on backend.')

    model = get_replicate_video_model()
    predictions_url = f'{REPLICATE_API_BASE}/models/{model}/predictions'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    payload = {
        'input': {
            'prompt': prompt,
            'start_image': image_url,
            'duration': duration,
            'aspect_ratio': '16:9',
            'negative_prompt': (
                'flicker, jitter, wobble, distortion, deformed face, deformed logo, '
                'warped geometry, unstable frame, noisy artifacts'
            ),
        },
    }

    prediction = json_request('POST', predictions_url, headers, payload)
    status_value = str(prediction.get('status') or '').lower()
    get_url = ((prediction.get('urls') or {}).get('get') or '').strip()
    if status_value in {'starting', 'processing'} and get_url:
        prediction = _poll_prediction(get_url, headers)
        status_value = str(prediction.get('status') or '').lower()

    if status_value not in {'succeeded', 'failed', 'canceled'}:
        raise RuntimeError('Video generation timed out before final output.')

    if status_value in {'failed', 'canceled'}:
        raise RuntimeError(
            prediction.get('error')
            or prediction.get('detail')
            or 'Video generation failed.'
        )

    video_url = _extract_video_url(prediction.get('output'))
    if not video_url:
        raise RuntimeError('Video generation completed without output URL.')

    return str(prediction.get('id') or ''), video_url
