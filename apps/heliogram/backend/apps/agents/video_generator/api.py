import json
import logging
import socket
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

from decouple import config
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o'
DEFAULT_REPLICATE_VIDEO_MODEL = 'kwaivgi/kling-v2.5-turbo-pro'
REPLICATE_API_BASE = 'https://api.replicate.com/v1'
REPLICATE_POLL_INTERVAL_SECONDS = 1.5
REPLICATE_MAX_POLLS = 120
NETWORK_RETRY_ATTEMPTS = 3
NETWORK_RETRY_BASE_DELAY_SECONDS = 0.8

KLING_PROMPT_PATH = Path(__file__).resolve().parent / 'prompts' / 'kling.txt'

VIDEO_IMAGE_PROMPT_SYSTEM = """You are a cinematic image prompt engineer.
Create one high-quality, model-ready image prompt in English.
Respect the provided brand and user request.
Output only the final prompt text without markdown, explanations, or JSON.
The prompt should be suitable for a keyframe image used as the first frame of a branded video.
"""

PROMPT_REPAIR_SYSTEM = """You rewrite noisy instruction dumps into one final production-ready prompt.
Return only one plain English prompt line.
Never include headings, bullets, role text, or policy/rule text.
Never include phrases like "You are", "MISSION", "OUTPUT FORMAT", "Execution Instructions", or "User Image Request".
"""

PROMPT_LEAK_MARKERS = (
    'you are a cinematic image prompt engineer',
    'you are a vision-to-kling prompt compiler',
    'you are the dedicated',
    'primary objective',
    'brand essence',
    'scene expansion rule',
    'output format',
    'execution instructions',
    'user image request',
    'final internal check',
    'return exactly one final english image prompt',
    'mission',
    'act video rule',
    'prompt construction order',
)

PROVIDER_SECRET_MARKERS = (
    'seedream',
    'kling',
    'openai/gpt-4o',
    'bytedance',
    'kwaivgi',
    'replicate.com',
)


def get_openrouter_token() -> str:
    return config('OPENROUTER_API_KEY', default=config('VITE_OPENROUTER_API_KEY', default='')).strip()


def get_openrouter_model() -> str:
    return config(
        'VIDEO_PROMPT_LLM_MODEL',
        default=config('OPENROUTER_MODEL', default=config('VITE_OPENROUTER_MODEL', default=DEFAULT_OPENROUTER_MODEL)),
    ).strip() or DEFAULT_OPENROUTER_MODEL


def get_replicate_token() -> str:
    return config('REPLICATE_API_TOKEN', default=config('VITE_REPLICATE_API_TOKEN', default='')).strip()


def get_replicate_video_model() -> str:
    model = config(
        'REPLICATE_VIDEO_MODEL',
        default=config('VITE_REPLICATE_VIDEO_MODEL', default=DEFAULT_REPLICATE_VIDEO_MODEL),
    ).strip() or DEFAULT_REPLICATE_VIDEO_MODEL

    # Backward compatibility: transparently migrate old model name.
    if model == 'kwaivgi/kling-v2.1-master':
        return DEFAULT_REPLICATE_VIDEO_MODEL
    return model


def _json_request(method: str, url: str, headers: dict, payload: dict | None = None) -> dict:
    body = None
    if payload is not None:
        body = json.dumps(payload).encode('utf-8')

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    for attempt in range(1, NETWORK_RETRY_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
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
            retryable = _is_retryable_network_error(reason)
            if retryable and attempt < NETWORK_RETRY_ATTEMPTS:
                delay = NETWORK_RETRY_BASE_DELAY_SECONDS * attempt
                logger.warning(
                    'Transient network error during %s %s (attempt %s/%s): %s. Retrying in %.1fs.',
                    method,
                    url,
                    attempt,
                    NETWORK_RETRY_ATTEMPTS,
                    reason,
                    delay,
                )
                time.sleep(delay)
                continue
            raise RuntimeError(f'Network error: {reason}') from url_error
        except (ssl.SSLError, socket.timeout, TimeoutError, ConnectionResetError, ConnectionAbortedError, OSError) as network_error:
            retryable = _is_retryable_network_error(network_error)
            if retryable and attempt < NETWORK_RETRY_ATTEMPTS:
                delay = NETWORK_RETRY_BASE_DELAY_SECONDS * attempt
                logger.warning(
                    'Transient low-level network error during %s %s (attempt %s/%s): %s. Retrying in %.1fs.',
                    method,
                    url,
                    attempt,
                    NETWORK_RETRY_ATTEMPTS,
                    network_error,
                    delay,
                )
                time.sleep(delay)
                continue
            raise RuntimeError(f'Network error: {network_error}') from network_error

    return {}


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


def _extract_openrouter_content(response_data: dict) -> str:
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


def _looks_like_instruction_dump(text: str) -> bool:
    normalized = (text or '').strip().lower()
    if not normalized:
        return False

    marker_hits = sum(1 for marker in PROMPT_LEAK_MARKERS if marker in normalized)
    line_count = sum(1 for line in normalized.splitlines() if line.strip())
    return marker_hits >= 2 or (len(normalized) > 950 and line_count > 10)


def _sanitize_provider_message(message: str, fallback: str) -> str:
    compact = ' '.join((message or '').split()).strip()
    if not compact:
        return fallback
    normalized = compact.lower()
    if _looks_like_instruction_dump(compact) or len(compact) > 420:
        return fallback
    if any(marker in normalized for marker in PROVIDER_SECRET_MARKERS):
        return fallback
    return compact


def _openrouter_chat(messages: list[dict], *, max_tokens: int = 700, temperature: float = 0.4) -> str:
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
        'HTTP-Referer': config('FRONTEND_URL', default='http://localhost:4000'),
        'X-OpenRouter-Title': 'Helio Video Generator',
    }
    data = _json_request('POST', OPENROUTER_CHAT_URL, headers, payload)
    content = _extract_openrouter_content(data)
    if not content:
        raise RuntimeError('OpenRouter returned empty content.')
    return _strip_code_fences(content)


def _repair_prompt_output(kind: str, brand: str, user_request: str, raw_output: str) -> str:
    messages = [
        {'role': 'system', 'content': PROMPT_REPAIR_SYSTEM},
        {
            'role': 'user',
            'content': (
                f'Task kind: {kind}\n'
                f'Brand: {brand}\n'
                f'User request: {user_request}\n'
                'Rewrite the leaked output below into one final production-ready prompt line.\n'
                'Leaked output:\n'
                f'{raw_output[:6000]}'
            ),
        },
    ]
    repaired = _openrouter_chat(messages, max_tokens=260, temperature=0.2)
    return ' '.join(repaired.split()).strip()


def _fallback_image_prompt(brand: str, user_request: str) -> str:
    return (
        f'Premium cinematic hero image for {brand}, centered on {user_request}, '
        'high-end materials, controlled lighting, commercial realism, sharp detail, editorial composition.'
    )


def _fallback_video_prompt(brand: str, user_request: str) -> str:
    return (
        f'Cinematic image-to-video shot for {brand}: preserve subject identity and scene from the source image, '
        f'animate {user_request} with smooth natural motion, stable geometry, subtle camera movement, premium lighting, realistic texture fidelity.'
    )


def _load_kling_system_prompt() -> str:
    if KLING_PROMPT_PATH.exists():
        prompt = KLING_PROMPT_PATH.read_text(encoding='utf-8', errors='ignore').replace('\ufeff', '')
        replacements = {
            '\u00e2\u20ac\u2122': "'",
            '\u00e2\u20ac\u0153': '"',
            '\u00e2\u20ac\u009d': '"',
            '\u00e2\u20ac\u201d': '-',
            '\u00e2\u20ac\u201c': '-',
            '\u00e2\u20ac\u00a6': '...',
        }
        for broken, fixed in replacements.items():
            prompt = prompt.replace(broken, fixed)
        return prompt.strip()
    return (
        'You are a Vision-to-Kling prompt compiler. Analyze the image and return one concise, '
        'production-ready English prompt for image-to-video generation while preserving identity and scene coherence.'
    )

def _poll_replicate_prediction(get_url: str, headers: dict) -> dict:
    poll_count = 0
    prediction = {}
    status_value = 'starting'

    while status_value in {'starting', 'processing'} and poll_count < REPLICATE_MAX_POLLS:
        poll_count += 1
        time.sleep(REPLICATE_POLL_INTERVAL_SECONDS)
        prediction = _json_request('GET', get_url, headers)
        status_value = str(prediction.get('status') or '').lower()

    return prediction


class VideoImagePromptView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user_request = (request.data.get('user_request') or '').strip()
        brand = (request.data.get('brand') or 'General').strip()
        if not user_request:
            return Response({'detail': 'user_request is required.'}, status=400)

        try:
            messages = [
                {'role': 'system', 'content': VIDEO_IMAGE_PROMPT_SYSTEM},
                {
                    'role': 'user',
                    'content': (
                        f'Brand: {brand}\n'
                        f'User request: {user_request}\n'
                        'Generate one final image prompt suitable for premium marketing visuals.'
                    ),
                },
            ]
            image_prompt = _openrouter_chat(messages, max_tokens=500, temperature=0.5)
            if _looks_like_instruction_dump(image_prompt):
                logger.warning('Detected instruction dump in image prompt output. Attempting repair.')
                image_prompt = _repair_prompt_output('image', brand, user_request, image_prompt)
            if _looks_like_instruction_dump(image_prompt) or not image_prompt.strip():
                logger.warning('Image prompt output still invalid after repair. Using fallback prompt.')
                image_prompt = _fallback_image_prompt(brand, user_request)
            return Response(
                {
                    'status': 'ok',
                    'image_prompt': image_prompt,
                },
                status=200,
            )
        except RuntimeError as runtime_error:
            logger.warning('Video image-prompt generation failed: %s', runtime_error)
            return Response(
                {
                    'detail': _sanitize_provider_message(
                        str(runtime_error),
                        'Image prompt generation failed upstream. Please retry in a few seconds.',
                    )
                },
                status=502,
            )
        except Exception:
            logger.exception('Unexpected server error while generating image prompt.')
            return Response({'detail': 'Unexpected server error while generating image prompt.'}, status=500)


class VideoPromptFromImageView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user_request = (request.data.get('user_request') or '').strip()
        image_url = (request.data.get('image_url') or '').strip()
        brand = (request.data.get('brand') or 'General').strip()
        if not user_request:
            return Response({'detail': 'user_request is required.'}, status=400)
        if not image_url:
            return Response({'detail': 'image_url is required.'}, status=400)

        system_prompt = _load_kling_system_prompt()
        try:
            messages = [
                {'role': 'system', 'content': system_prompt},
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': (
                                f'Brand: {brand}\n'
                                f'Original user request: {user_request}\n'
                                'Create one Kling-ready motion prompt in English for image-to-video generation.\n'
                                'Return only the final prompt text.'
                            ),
                        },
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': image_url,
                            },
                        },
                    ],
                },
            ]
            video_prompt = _openrouter_chat(messages, max_tokens=600, temperature=0.35)
            if _looks_like_instruction_dump(video_prompt):
                logger.warning('Detected instruction dump in video prompt output. Attempting repair.')
                video_prompt = _repair_prompt_output('video', brand, user_request, video_prompt)
            if _looks_like_instruction_dump(video_prompt) or not video_prompt.strip():
                logger.warning('Video prompt output still invalid after repair. Using fallback prompt.')
                video_prompt = _fallback_video_prompt(brand, user_request)
            return Response(
                {
                    'status': 'ok',
                    'video_prompt': video_prompt,
                },
                status=200,
            )
        except RuntimeError as runtime_error:
            logger.warning('Video prompt-from-image generation failed: %s', runtime_error)
            return Response(
                {
                    'detail': _sanitize_provider_message(
                        str(runtime_error),
                        'Video prompt extraction failed upstream. Please retry in a few seconds.',
                    )
                },
                status=502,
            )
        except Exception:
            logger.exception('Unexpected server error while generating video prompt.')
            return Response({'detail': 'Unexpected server error while generating video prompt.'}, status=500)


class VideoGenerationProxyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        replicate_token = get_replicate_token()
        if not replicate_token:
            return Response({'detail': 'REPLICATE_API_TOKEN is not configured on backend.'}, status=500)

        video_prompt = (request.data.get('video_prompt') or '').strip()
        image_url = (request.data.get('image_url') or '').strip()
        if not video_prompt:
            return Response({'detail': 'video_prompt is required.'}, status=400)
        if not image_url:
            return Response({'detail': 'image_url is required.'}, status=400)

        duration = request.data.get('duration', 5)
        try:
            duration = int(duration)
        except (TypeError, ValueError):
            duration = 5

        model = get_replicate_video_model()
        predictions_url = f'{REPLICATE_API_BASE}/models/{model}/predictions'
        headers = {
            'Authorization': f'Bearer {replicate_token}',
            'Content-Type': 'application/json',
        }
        payload = {
                'input': {
                    'prompt': video_prompt,
                    'start_image': image_url,
                    'duration': duration,
                    'aspect_ratio': '16:9',
                    'negative_prompt': (
                        'flicker, jitter, wobble, distortion, deformed face, deformed logo, '
                        'warped geometry, unstable frame, noisy artifacts'
                ),
            },
        }

        try:
            prediction = _json_request('POST', predictions_url, headers, payload)
            status_value = str(prediction.get('status') or '').lower()
            get_url = ((prediction.get('urls') or {}).get('get') or '').strip()
            if status_value in {'starting', 'processing'} and get_url:
                prediction = _poll_replicate_prediction(get_url, headers)
                status_value = str(prediction.get('status') or '').lower()

            if status_value not in {'succeeded', 'failed', 'canceled'}:
                return Response({'detail': 'Video generation timed out before final output.'}, status=504)

            if status_value in {'failed', 'canceled'}:
                return Response(
                    {'detail': prediction.get('error') or prediction.get('detail') or 'Video generation failed.'},
                    status=502,
                )

            output = prediction.get('output')
            if isinstance(output, str) and output.startswith('http'):
                video_url = output
            elif isinstance(output, list):
                video_url = next((item for item in output if isinstance(item, str) and item.startswith('http')), '')
            else:
                video_url = ''

            if not video_url:
                return Response({'detail': 'Video generation completed without output URL.'}, status=502)

            return Response(
                {
                    'status': 'succeeded',
                    'prediction_id': prediction.get('id'),
                    'video_url': video_url,
                },
                status=200,
            )
        except RuntimeError as runtime_error:
            logger.warning('Video generation failed: %s', runtime_error)
            return Response(
                {
                    'detail': _sanitize_provider_message(
                        str(runtime_error),
                        'Video rendering failed upstream. Please retry in a few seconds.',
                    )
                },
                status=502,
            )
        except Exception:
            logger.exception('Unexpected server error during video generation.')
            return Response({'detail': 'Unexpected server error during video generation.'}, status=500)

