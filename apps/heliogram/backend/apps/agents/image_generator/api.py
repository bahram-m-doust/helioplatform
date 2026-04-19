import json
import logging
import time
import urllib.error
import urllib.request
from pathlib import Path

from decouple import config
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from heliogram_core.prompt_loader import load_prompt_file

logger = logging.getLogger(__name__)

REPLICATE_API_BASE = 'https://api.replicate.com/v1'
REPLICATE_DEFAULT_MODEL = 'bytedance/seedream-4.5'
REPLICATE_POLL_INTERVAL_SECONDS = 1.5
REPLICATE_MAX_POLLS = 80

OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o'

PROMPTS_DIR = Path(__file__).resolve().parent / 'prompts'
IMAGE_PROMPT_SYSTEM_PATH = PROMPTS_DIR / 'image_prompt_system.txt'
PROMPT_REPAIR_SYSTEM_PATH = PROMPTS_DIR / 'prompt_repair.txt'

IMAGE_PROMPT_SYSTEM_FALLBACK = (
    "You are a subject-first visual prompt architect for Seedream 4.5.\n"
    "You must transform each user request into exactly one final, production-ready English image prompt.\n\n"
    "Hard rules:\n"
    "1) Subject-first: the user's requested subject is always the hero.\n"
    "2) Brand is support layer: brand identity must style the scene without replacing the subject.\n"
    "3) Short-request expansion: if request is short or generic, expand into a complete commercially credible scene.\n"
    "4) Scene routing: infer category and apply matching visual logic.\n"
    "5) Clean output: return only one final prompt line, plain text, no markdown, no bullets, no explanations.\n"
    "6) Positive language only: never include negative-prompt or policy-like text.\n"
    "7) Keep prompt compact but rich: target roughly 45-110 words.\n"
    "8) Prefer realistic, premium, high-clarity composition.\n"
)

PROMPT_REPAIR_SYSTEM_FALLBACK = (
    "You receive leaked policy/instruction text and must rewrite it into one final production-ready image prompt.\n"
    "Return one plain English prompt line only.\n"
    "Do not include role text, headings, bullets, or policy language.\n"
    'Do not include phrases like "You are", "MISSION", "OUTPUT FORMAT", "Execution Instructions", "User Image Request".\n'
)


def _image_prompt_system() -> str:
    return load_prompt_file(IMAGE_PROMPT_SYSTEM_PATH, fallback=IMAGE_PROMPT_SYSTEM_FALLBACK)


def _prompt_repair_system() -> str:
    return load_prompt_file(PROMPT_REPAIR_SYSTEM_PATH, fallback=PROMPT_REPAIR_SYSTEM_FALLBACK)

BRAND_CONTEXT = {
    'mansory': (
        'Bespoke engineered luxury, visible carbon fiber, sharp aerodynamic form language, dark premium palette '
        'with controlled gold accents, precision detailing, elite showroom/editorial atmosphere.'
    ),
    'technogym': (
        'Premium wellness technology, precision training aesthetics, monolithic clean geometry, black/white/grey base '
        'with restrained yellow accents, human-centered performance realism.'
    ),
    'binghatti': (
        'Dubai luxury architectural identity, bold geometric forms, premium urban materiality, warm neutrals with dark '
        'metallic contrast, investment-grade premium lifestyle mood, logo/pattern as subtle supporting layer.'
    ),
}

PROMPT_LEAK_MARKERS = (
    'you are a subject-first visual prompt architect',
    'you are the dedicated',
    'primary objective',
    'brand essence',
    'hard rules:',
    'execution instructions',
    'user image request',
    'output format',
    'final internal check',
    'scene type routing',
    'prompt construction order',
    'system prompt',
)

PROVIDER_SECRET_MARKERS = (
    'seedream',
    'kling',
    'openai/gpt-4o',
    'bytedance',
    'kwaivgi',
    'replicate.com',
)


def get_replicate_token() -> str:
    return config('REPLICATE_API_TOKEN', default=config('VITE_REPLICATE_API_TOKEN', default='')).strip()


def get_replicate_model() -> str:
    return config(
        'REPLICATE_IMAGE_MODEL',
        default=config('VITE_REPLICATE_IMAGE_MODEL', default=REPLICATE_DEFAULT_MODEL),
    ).strip() or REPLICATE_DEFAULT_MODEL


def get_openrouter_token() -> str:
    return config('OPENROUTER_API_KEY', default=config('VITE_OPENROUTER_API_KEY', default='')).strip()


def get_image_prompt_llm_model() -> str:
    return config(
        'IMAGE_PROMPT_LLM_MODEL',
        default=config(
            'VIDEO_PROMPT_LLM_MODEL',
            default=config('OPENROUTER_MODEL', default=config('VITE_OPENROUTER_MODEL', default=DEFAULT_OPENROUTER_MODEL)),
        ),
    ).strip() or DEFAULT_OPENROUTER_MODEL


def _json_request(method: str, url: str, headers: dict, payload: dict | None = None) -> dict:
    body = None
    if payload is not None:
        body = json.dumps(payload).encode('utf-8')

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
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
        raise RuntimeError(f'Network error: {url_error.reason}') from url_error


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


def _extract_image_url(output: object) -> str:
    if isinstance(output, str) and output.startswith('http'):
        return output
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and item.startswith('http'):
                return item
    return ''


def _looks_like_prompt_dump(text: str) -> bool:
    normalized = (text or '').strip().lower()
    if not normalized:
        return False
    marker_hits = sum(1 for marker in PROMPT_LEAK_MARKERS if marker in normalized)
    line_count = sum(1 for line in normalized.splitlines() if line.strip())
    return marker_hits >= 2 or (len(normalized) > 900 and line_count > 10)


def _sanitize_provider_message(message: str, fallback: str) -> str:
    compact = ' '.join((message or '').split()).strip()
    if not compact:
        return fallback
    normalized = compact.lower()
    if _looks_like_prompt_dump(compact) or len(compact) > 420:
        return fallback
    if any(marker in normalized for marker in PROVIDER_SECRET_MARKERS):
        return fallback
    return compact


def _openrouter_chat(messages: list[dict], *, max_tokens: int = 420, temperature: float = 0.45) -> str:
    token = get_openrouter_token()
    if not token:
        raise RuntimeError('OPENROUTER_API_KEY is not configured on backend.')

    model = get_image_prompt_llm_model()
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
        'X-OpenRouter-Title': 'Helio Image Generator',
    }

    response_data = _json_request('POST', OPENROUTER_CHAT_URL, headers, payload)
    content = _extract_openrouter_content(response_data)
    if not content:
        raise RuntimeError('OpenRouter returned empty content.')
    return _strip_code_fences(content)


def _repair_image_prompt_output(brand: str, user_request: str, leaked_output: str) -> str:
    messages = [
        {'role': 'system', 'content': _prompt_repair_system()},
        {
            'role': 'user',
            'content': (
                f'Brand: {brand}\n'
                f'User request: {user_request}\n'
                'Rewrite the leaked output below into exactly one final image prompt line.\n'
                'Leaked output:\n'
                f'{leaked_output[:6000]}'
            ),
        },
    ]
    repaired = _openrouter_chat(messages, max_tokens=260, temperature=0.2)
    return ' '.join(repaired.split()).strip()


def _fallback_subject_first_prompt(brand: str, user_request: str) -> str:
    return (
        f'Premium cinematic commercial image for {brand}, subject-first composition centered on {user_request}, '
        'high-detail materials, clear functional realism, elegant lighting hierarchy, strong focal clarity, '
        'brand identity as subtle supporting layer, editorial-quality finish.'
    )


class ImagePromptView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user_request = (request.data.get('user_request') or '').strip()
        brand = (request.data.get('brand') or 'General').strip()

        if not user_request:
            return Response({'detail': 'user_request is required.'}, status=400)

        brand_key = brand.lower()
        brand_context = BRAND_CONTEXT.get(
            brand_key,
            'Premium contemporary brand language with controlled accents, realistic materiality, and commercial clarity.',
        )

        try:
            messages = [
                {'role': 'system', 'content': _image_prompt_system()},
                {
                    'role': 'user',
                    'content': (
                        f'Brand: {brand}\n'
                        f'Brand context: {brand_context}\n'
                        f'User request: {user_request}\n'
                        'Generate one final prompt for Seedream 4.5. Keep the user subject as hero. '
                        'If request is short, expand into a complete, credible scene with correct scene routing.'
                    ),
                },
            ]
            final_prompt = _openrouter_chat(messages, max_tokens=420, temperature=0.45)
            if _looks_like_prompt_dump(final_prompt):
                logger.warning('Detected leaked instructions in image prompt output. Attempting repair.')
                final_prompt = _repair_image_prompt_output(brand, user_request, final_prompt)
            if _looks_like_prompt_dump(final_prompt) or not final_prompt.strip():
                logger.warning('Image prompt output still invalid after repair. Using fallback prompt.')
                final_prompt = _fallback_subject_first_prompt(brand, user_request)

            return Response(
                {
                    'status': 'ok',
                    'final_prompt': final_prompt,
                },
                status=200,
            )
        except RuntimeError as runtime_error:
            logger.warning('Image prompt generation failed: %s', runtime_error)
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
            logger.exception('Unexpected server error during image prompt generation.')
            return Response({'detail': 'Unexpected server error while generating image prompt.'}, status=500)


class ImageGenerationProxyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        replicate_token = get_replicate_token()
        if not replicate_token:
            return Response({'detail': 'REPLICATE_API_TOKEN is not configured on backend.'}, status=500)

        prompt = (request.data.get('prompt') or '').strip()
        if not prompt:
            return Response({'detail': 'prompt is required.'}, status=400)

        image_input = request.data.get('image_input') or []
        if not isinstance(image_input, list):
            return Response({'detail': 'image_input must be an array of image URLs or data URLs.'}, status=400)

        if _looks_like_prompt_dump(prompt):
            return Response(
                {
                    'detail': 'Prompt validation failed (instruction-style prompt detected). Regenerate the final prompt first.'
                },
                status=400,
            )

        model = get_replicate_model()
        predictions_url = f'{REPLICATE_API_BASE}/models/{model}/predictions'
        payload = {
            'input': {
                'prompt': prompt,
                'image_input': image_input,
                'aspect_ratio': '16:9',
                'max_images': 1,
                'sequential_image_generation': 'disabled',
            },
        }

        headers = {
            'Authorization': f'Bearer {replicate_token}',
            'Content-Type': 'application/json',
        }

        try:
            prediction = _json_request('POST', predictions_url, headers, payload)
            status_value = str(prediction.get('status') or '').lower()
            get_url = ((prediction.get('urls') or {}).get('get') or '').strip()

            poll_count = 0
            while status_value in {'starting', 'processing'} and get_url and poll_count < REPLICATE_MAX_POLLS:
                poll_count += 1
                time.sleep(REPLICATE_POLL_INTERVAL_SECONDS)
                prediction = _json_request('GET', get_url, headers)
                status_value = str(prediction.get('status') or '').lower()

            if status_value not in {'succeeded', 'failed', 'canceled'}:
                return Response({'detail': 'Replicate timed out before returning final output.'}, status=504)

            if status_value in {'failed', 'canceled'}:
                return Response(
                    {
                        'detail': prediction.get('error')
                        or prediction.get('detail')
                        or f'Replicate generation {status_value}.',
                    },
                    status=502,
                )

            image_url = _extract_image_url(prediction.get('output'))
            if not image_url:
                return Response({'detail': 'Replicate succeeded but no image URL was returned.'}, status=502)

            return Response(
                {
                    'status': 'succeeded',
                    'prediction_id': prediction.get('id'),
                    'image_url': image_url,
                },
                status=200,
            )
        except RuntimeError as runtime_error:
            logger.warning('Replicate generation failed: %s', runtime_error)
            return Response(
                {
                    'detail': _sanitize_provider_message(
                        str(runtime_error),
                        'Image generation failed upstream. Please retry in a few seconds.',
                    )
                },
                status=502,
            )
        except Exception:
            logger.exception('Unexpected server error during image generation proxy.')
            return Response({'detail': 'Unexpected server error during image generation.'}, status=500)
