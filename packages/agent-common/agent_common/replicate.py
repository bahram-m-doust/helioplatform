"""Replicate prediction client (image, video, anything else).

Generic over the model and the request payload. The image and video agents
both call ``run_prediction`` with their own ``model`` + ``inputs`` mapping,
poll until the prediction terminates, and unpack the first ``http`` URL
out of the (possibly nested) ``output`` field.
"""

from __future__ import annotations

import logging
import os
import time

from agent_common.http_client import json_request

logger = logging.getLogger(__name__)

REPLICATE_API_BASE = 'https://api.replicate.com/v1'
REPLICATE_POLL_INTERVAL_SECONDS = 1.5


def get_replicate_token() -> str:
    return (os.getenv('REPLICATE_API_TOKEN') or '').strip()


def _extract_url(output: object) -> str:
    """Pull the first ``http(s)://`` URL out of a Replicate ``output`` payload."""
    if isinstance(output, str) and output.startswith('http'):
        return output
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and item.startswith('http'):
                return item
    return ''


def run_prediction(
    *,
    model: str,
    inputs: dict,
    max_polls: int = 80,
    failure_message: str = 'Replicate generation failed.',
) -> tuple[str, str]:
    """Submit a prediction, poll to completion, return ``(prediction_id, output_url)``.

    Raises ``RuntimeError`` if the token is missing, the model never finishes
    in time, the prediction ends in ``failed`` / ``canceled``, or no URL
    can be extracted from the output.
    """
    token = get_replicate_token()
    if not token:
        raise RuntimeError('REPLICATE_API_TOKEN is not configured on backend.')

    predictions_url = f'{REPLICATE_API_BASE}/models/{model}/predictions'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    prediction = json_request('POST', predictions_url, headers, {'input': inputs})
    status_value = str(prediction.get('status') or '').lower()
    get_url = ((prediction.get('urls') or {}).get('get') or '').strip()

    poll_count = 0
    while status_value in {'starting', 'processing'} and get_url and poll_count < max_polls:
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
            or failure_message
        )

    output_url = _extract_url(prediction.get('output'))
    if not output_url:
        raise RuntimeError('Replicate succeeded but no output URL was returned.')

    return str(prediction.get('id') or ''), output_url
