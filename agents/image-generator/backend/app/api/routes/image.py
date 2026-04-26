"""Image agent HTTP routes.

- POST /api/prompt     -> generate a final image prompt via OpenRouter.
- POST /api/generate   -> run the image prompt through Replicate (Seedream).
"""

from __future__ import annotations

import logging
from hmac import compare_digest
from datetime import UTC, datetime
from threading import Lock
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import (
    DEBUG,
    FRAMER_IMAGE_ALLOWED_ORIGINS,
    FRAMER_IMAGE_API_TOKEN,
    FRAMER_IMAGE_MAX_PROMPT_CHARS,
    FRAMER_IMAGE_MAX_REFERENCE_IMAGES,
    FRAMER_IMAGE_RATE_LIMIT_PER_MINUTE,
)
from app.services.openrouter import openrouter_chat
from app.services.prompts import (
    BRAND_CONTEXT,
    DEFAULT_BRAND_CONTEXT,
    fallback_subject_first_prompt,
    image_prompt_system,
    prompt_repair_system,
)
from app.services.replicate import run_image_prediction
from app.services.sanitize import looks_like_prompt_dump, sanitize_provider_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["image"])

FRAMER_JOB_TTL_SECONDS = 60 * 60
FRAMER_MAX_JOBS = 200
_framer_jobs_lock = Lock()
_framer_jobs: dict[str, dict[str, object]] = {}
_framer_rate_limit_lock = Lock()
_framer_rate_limits: dict[str, list[float]] = {}


class PromptRequest(BaseModel):
    user_request: str = Field(default="", description="Freeform description of the desired subject/scene.")
    brand: str = Field(default="General", description="Brand profile key (Mansory/Technogym/Binghatti/General).")


class PromptResponse(BaseModel):
    status: str = "ok"
    final_prompt: str


class GenerateRequest(BaseModel):
    prompt: str = Field(default="", description="Final image prompt from /api/prompt.")
    image_input: list[str] = Field(default_factory=list, description="Optional reference image URLs or data URLs.")


class GenerateResponse(BaseModel):
    status: str = "succeeded"
    prediction_id: str | None = None
    image_url: str


class FramerGenerateRequest(BaseModel):
    tenantId: str | None = Field(default=None, max_length=80, description="Optional Framer tenant identifier.")
    prompt: str = Field(
        default="",
        max_length=FRAMER_IMAGE_MAX_PROMPT_CHARS,
        description="Image prompt submitted by the Framer component.",
    )
    image_input: list[str] = Field(default_factory=list, description="Optional reference image URLs or data URLs.")


class FramerGenerateResponse(BaseModel):
    jobId: str


class FramerJobResponse(BaseModel):
    status: str
    progress: float | None = None
    imageUrl: str | None = None
    error: str | None = None


def _normalize_origin(value: str) -> str:
    parsed = urlparse(value.strip())
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}".rstrip("/")


def _origin_from_referer(value: str | None) -> str:
    return _normalize_origin(value or "")


def _verify_framer_token(authorization: str | None = Header(default=None)) -> None:
    if not FRAMER_IMAGE_API_TOKEN and not DEBUG:
        raise HTTPException(status_code=503, detail="Framer image API token is not configured.")

    if not FRAMER_IMAGE_API_TOKEN:
        return

    expected = f"Bearer {FRAMER_IMAGE_API_TOKEN}"
    if not authorization or not compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API token.")


def _verify_framer_origin(
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
) -> None:
    allowed_origins = set(FRAMER_IMAGE_ALLOWED_ORIGINS)
    if not allowed_origins:
        raise HTTPException(status_code=503, detail="Framer allowed origins are not configured.")

    request_origin = _normalize_origin(origin or "") or _origin_from_referer(referer)
    if request_origin not in allowed_origins:
        raise HTTPException(status_code=403, detail="Origin is not allowed.")


def _verify_framer_request(
    _token: None = Depends(_verify_framer_token),
    _origin: None = Depends(_verify_framer_origin),
) -> None:
    return None


def _client_key(request: Request, tenant_id: str | None) -> str:
    if tenant_id:
        return f"tenant:{tenant_id[:80]}"

    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded_for.split(",", 1)[0].strip()
    if not client_ip and request.client:
        client_ip = request.client.host
    return f"ip:{client_ip or 'unknown'}"


def _check_framer_rate_limit(request: Request, tenant_id: str | None) -> None:
    if FRAMER_IMAGE_RATE_LIMIT_PER_MINUTE <= 0:
        return

    now = _utc_timestamp()
    window_start = now - 60
    key = _client_key(request, tenant_id)

    with _framer_rate_limit_lock:
        attempts = [timestamp for timestamp in _framer_rate_limits.get(key, []) if timestamp >= window_start]
        if len(attempts) >= FRAMER_IMAGE_RATE_LIMIT_PER_MINUTE:
            raise HTTPException(status_code=429, detail="Too many generation requests. Please try again later.")
        attempts.append(now)
        _framer_rate_limits[key] = attempts


def _utc_timestamp() -> float:
    return datetime.now(UTC).timestamp()


def _prune_framer_jobs() -> None:
    now = _utc_timestamp()
    expired_job_ids = [
        job_id
        for job_id, job in _framer_jobs.items()
        if now - float(job.get("updated_at") or job.get("created_at") or now) > FRAMER_JOB_TTL_SECONDS
    ]
    for job_id in expired_job_ids:
        _framer_jobs.pop(job_id, None)

    if len(_framer_jobs) <= FRAMER_MAX_JOBS:
        return

    sorted_jobs = sorted(
        _framer_jobs.items(),
        key=lambda item: float(item[1].get("updated_at") or item[1].get("created_at") or 0),
    )
    for job_id, _job in sorted_jobs[: len(_framer_jobs) - FRAMER_MAX_JOBS]:
        _framer_jobs.pop(job_id, None)


def _set_framer_job(job_id: str, **updates: object) -> None:
    with _framer_jobs_lock:
        job = _framer_jobs.setdefault(
            job_id,
            {
                "status": "queued",
                "progress": 0.0,
                "created_at": _utc_timestamp(),
            },
        )
        job.update(updates)
        job["updated_at"] = _utc_timestamp()


def _run_framer_image_job(job_id: str, prompt: str, image_input: list[str]) -> None:
    _set_framer_job(job_id, status="running", progress=0.15, error=None)
    try:
        prediction_id, image_url = run_image_prediction(prompt=prompt, image_input=image_input)
        _set_framer_job(
            job_id,
            status="succeeded",
            progress=1.0,
            imageUrl=image_url,
            prediction_id=prediction_id or None,
            error=None,
        )
    except RuntimeError as runtime_error:
        logger.warning("Framer image generation job failed: %s", runtime_error)
        _set_framer_job(
            job_id,
            status="failed",
            progress=1.0,
            error=sanitize_provider_message(
                str(runtime_error),
                "Image generation failed upstream. Please retry in a few seconds.",
            ),
        )
    except Exception as exc:
        logger.exception("Unexpected server error during Framer image generation job.")
        _set_framer_job(
            job_id,
            status="failed",
            progress=1.0,
            error="Unexpected server error during image generation.",
        )


def _repair_image_prompt_output(brand: str, user_request: str, leaked_output: str) -> str:
    messages = [
        {"role": "system", "content": prompt_repair_system()},
        {
            "role": "user",
            "content": (
                f"Brand: {brand}\n"
                f"User request: {user_request}\n"
                "Rewrite the leaked output below into exactly one final image prompt line.\n"
                "Leaked output:\n"
                f"{leaked_output[:6000]}"
            ),
        },
    ]
    repaired = openrouter_chat(
        messages,
        max_tokens=260,
        temperature=0.2,
        service_title="Helio Image Generator",
    )
    return " ".join(repaired.split()).strip()


@router.post("/prompt", response_model=PromptResponse)
def generate_prompt(payload: PromptRequest) -> PromptResponse:
    user_request = (payload.user_request or "").strip()
    brand = (payload.brand or "General").strip()
    if not user_request:
        raise HTTPException(status_code=400, detail="user_request is required.")

    brand_context = BRAND_CONTEXT.get(brand.lower(), DEFAULT_BRAND_CONTEXT)

    try:
        messages = [
            {"role": "system", "content": image_prompt_system()},
            {
                "role": "user",
                "content": (
                    f"Brand: {brand}\n"
                    f"Brand context: {brand_context}\n"
                    f"User request: {user_request}\n"
                    "Generate one final prompt for Seedream 4.5. Keep the user subject as hero. "
                    "If request is short, expand into a complete, credible scene with correct scene routing."
                ),
            },
        ]
        final_prompt = openrouter_chat(
            messages,
            max_tokens=420,
            temperature=0.45,
            service_title="Helio Image Generator",
        )
        if looks_like_prompt_dump(final_prompt):
            logger.warning("Detected leaked instructions in image prompt output. Attempting repair.")
            final_prompt = _repair_image_prompt_output(brand, user_request, final_prompt)
        if looks_like_prompt_dump(final_prompt) or not final_prompt.strip():
            logger.warning("Image prompt output still invalid after repair. Using fallback prompt.")
            final_prompt = fallback_subject_first_prompt(brand, user_request)
        return PromptResponse(final_prompt=final_prompt)
    except RuntimeError as runtime_error:
        logger.warning("Image prompt generation failed: %s", runtime_error)
        raise HTTPException(
            status_code=502,
            detail=sanitize_provider_message(
                str(runtime_error),
                "Image prompt generation failed upstream. Please retry in a few seconds.",
            ),
        ) from runtime_error
    except Exception as exc:
        logger.exception("Unexpected server error during image prompt generation.")
        raise HTTPException(
            status_code=500,
            detail="Unexpected server error while generating image prompt.",
        ) from exc


@router.post("/generate", response_model=GenerateResponse)
def generate_image(payload: GenerateRequest) -> GenerateResponse:
    prompt = (payload.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required.")

    if not isinstance(payload.image_input, list):
        raise HTTPException(
            status_code=400,
            detail="image_input must be an array of image URLs or data URLs.",
        )

    if looks_like_prompt_dump(prompt):
        raise HTTPException(
            status_code=400,
            detail="Prompt validation failed (instruction-style prompt detected). Regenerate the final prompt first.",
        )

    try:
        prediction_id, image_url = run_image_prediction(
            prompt=prompt,
            image_input=payload.image_input,
        )
        return GenerateResponse(
            status="succeeded",
            prediction_id=prediction_id or None,
            image_url=image_url,
        )
    except RuntimeError as runtime_error:
        logger.warning("Replicate image generation failed: %s", runtime_error)
        detail = sanitize_provider_message(
            str(runtime_error),
            "Image generation failed upstream. Please retry in a few seconds.",
        )
        status_code = 500 if "not configured" in str(runtime_error) else 502
        raise HTTPException(status_code=status_code, detail=detail) from runtime_error
    except Exception as exc:
        logger.exception("Unexpected server error during image generation proxy.")
        raise HTTPException(
            status_code=500,
            detail="Unexpected server error during image generation.",
        ) from exc


@router.post(
    "/images/generate",
    response_model=FramerGenerateResponse,
    dependencies=[Depends(_verify_framer_request)],
)
def create_framer_image_job(
    payload: FramerGenerateRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> FramerGenerateResponse:
    prompt = (payload.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required.")

    if not isinstance(payload.image_input, list):
        raise HTTPException(
            status_code=400,
            detail="image_input must be an array of image URLs or data URLs.",
        )

    if len(payload.image_input) > FRAMER_IMAGE_MAX_REFERENCE_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"image_input may include at most {FRAMER_IMAGE_MAX_REFERENCE_IMAGES} reference images.",
        )

    if looks_like_prompt_dump(prompt):
        raise HTTPException(
            status_code=400,
            detail="Prompt validation failed (instruction-style prompt detected).",
        )

    _check_framer_rate_limit(request, payload.tenantId)

    job_id = uuid4().hex
    with _framer_jobs_lock:
        _prune_framer_jobs()
        _framer_jobs[job_id] = {
            "status": "queued",
            "progress": 0.0,
            "tenantId": payload.tenantId,
            "created_at": _utc_timestamp(),
            "updated_at": _utc_timestamp(),
        }

    background_tasks.add_task(_run_framer_image_job, job_id, prompt, payload.image_input)
    return FramerGenerateResponse(jobId=job_id)


@router.get(
    "/images/jobs/{job_id}",
    response_model=FramerJobResponse,
    dependencies=[Depends(_verify_framer_request)],
)
def get_framer_image_job(job_id: str) -> FramerJobResponse:
    with _framer_jobs_lock:
        _prune_framer_jobs()
        job = dict(_framer_jobs.get(job_id) or {})

    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return FramerJobResponse(
        status=str(job.get("status") or "queued"),
        progress=float(job["progress"]) if isinstance(job.get("progress"), (int, float)) else None,
        imageUrl=str(job["imageUrl"]) if job.get("imageUrl") else None,
        error=str(job["error"]) if job.get("error") else None,
    )
