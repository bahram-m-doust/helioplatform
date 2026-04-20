"""Minimal JSON HTTP helper used to call external providers.

Uses stdlib ``urllib`` so the microservice has zero extra dependencies
beyond FastAPI + uvicorn. Retries transient network errors but surfaces
HTTP errors immediately so callers can translate them into 502s.
"""

from __future__ import annotations

import json
import logging
import socket
import ssl
import time
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

NETWORK_RETRY_ATTEMPTS = 3
NETWORK_RETRY_BASE_DELAY_SECONDS = 0.8


def _is_retryable_network_error(reason: object) -> bool:
    message = str(reason or '').lower()
    if not message:
        return False

    non_retryable_markers = (
        'certificate verify failed',
        'hostname mismatch',
        'name or service not known',
        'nodename nor servname provided',
        'getaddrinfo failed',
    )
    if any(marker in message for marker in non_retryable_markers):
        return False

    retryable_markers = (
        'unexpected eof while reading',
        'eof occurred in violation of protocol',
        'connection reset by peer',
        'remote end closed connection without response',
        'temporarily unavailable',
        'timed out',
        'timeout',
    )
    return any(marker in message for marker in retryable_markers)


def json_request(
    method: str,
    url: str,
    headers: dict,
    payload: dict | None = None,
    *,
    timeout: int = 120,
) -> dict:
    body = None
    if payload is not None:
        body = json.dumps(payload).encode('utf-8')

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    for attempt in range(1, NETWORK_RETRY_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                content = response.read().decode('utf-8')
                if not content:
                    return {}
                return json.loads(content)
        except urllib.error.HTTPError as http_error:
            error_body = http_error.read().decode('utf-8')
            try:
                parsed = json.loads(error_body) if error_body else {}
            except json.JSONDecodeError:
                parsed = {'detail': error_body or f'HTTP {http_error.code}'}
            raise RuntimeError(
                parsed.get('detail')
                or parsed.get('error')
                or parsed.get('message')
                or f'HTTP {http_error.code}'
            ) from http_error
        except urllib.error.URLError as url_error:
            reason = url_error.reason
            if _is_retryable_network_error(reason) and attempt < NETWORK_RETRY_ATTEMPTS:
                delay = NETWORK_RETRY_BASE_DELAY_SECONDS * attempt
                logger.warning(
                    'Transient network error during %s %s (%s/%s): %s. Retry in %.1fs.',
                    method, url, attempt, NETWORK_RETRY_ATTEMPTS, reason, delay,
                )
                time.sleep(delay)
                continue
            raise RuntimeError(f'Network error: {reason}') from url_error
        except (ssl.SSLError, socket.timeout, TimeoutError, ConnectionResetError,
                ConnectionAbortedError, OSError) as network_error:
            if _is_retryable_network_error(network_error) and attempt < NETWORK_RETRY_ATTEMPTS:
                delay = NETWORK_RETRY_BASE_DELAY_SECONDS * attempt
                logger.warning(
                    'Transient low-level network error during %s %s (%s/%s): %s. Retry in %.1fs.',
                    method, url, attempt, NETWORK_RETRY_ATTEMPTS, network_error, delay,
                )
                time.sleep(delay)
                continue
            raise RuntimeError(f'Network error: {network_error}') from network_error

    return {}
