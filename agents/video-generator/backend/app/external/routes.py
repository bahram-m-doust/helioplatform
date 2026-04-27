"""External (public) routes for the video-generator agent.

Single ``POST /generate`` that hides the internal three-step flow
(image-prompt -> motion-prompt -> render) and applies per-brand
overrides, quota gating, and audit logging.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, status

from agent_common.tenant import (
    TenantContext,
    consume_quota,
    get_brand_agent_config,
    record_run,
)

from app.external.schemas import GenerateRequest, GenerateResponse
from app.external.security import require_tenant
from app.services.openrouter import openrouter_chat
from app.services.prompts import (
    fallback_video_prompt,
    kling_system_prompt,
    prompt_repair_system,
)
from app.services.replicate import run_video_prediction
from app.services.sanitize import looks_like_instruction_dump, sanitize_provider_message

logger = logging.getLogger(__name__)

AGENT_KIND = "video"
# Video renders are far more expensive than image renders. Default cost
# at 60 cents/run; operators tune their brand_quotas.monthly_budget_cents.
COST_CENTS_PER_RUN = 60

router = APIRouter(prefix="/v1", tags=["external:video"])


def _build_motion_prompt(
    user_request: str,
    image_url: str,
    brand: str,
    *,
    system_prompt_override: str | None,
) -> str:
    system_prompt = system_prompt_override or kling_system_prompt()
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        f"Brand: {brand}\n"
                        f"Original user request: {user_request}\n"
                        "Create one Kling-ready motion prompt in English for image-to-video.\n"
                        "Return only the final prompt text."
                    ),
                },
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        },
    ]
    motion_prompt = openrouter_chat(messages, max_tokens=600, temperature=0.35)
    if looks_like_instruction_dump(motion_prompt):
        repaired = openrouter_chat(
            [
                {"role": "system", "content": prompt_repair_system()},
                {
                    "role": "user",
                    "content": (
                        f"Brand: {brand}\n"
                        f"User request: {user_request}\n"
                        "Rewrite the leaked output below into one final motion prompt line.\n"
                        f"Leaked output:\n{motion_prompt[:6000]}"
                    ),
                },
            ],
            max_tokens=260,
            temperature=0.2,
        )
        motion_prompt = " ".join(repaired.split()).strip()
    if looks_like_instruction_dump(motion_prompt) or not motion_prompt.strip():
        motion_prompt = fallback_video_prompt(brand, user_request)
    return motion_prompt


@router.post(
    "/generate",
    response_model=GenerateResponse,
    summary="Animate a still image into a short video.",
)
async def generate(
    payload: GenerateRequest,
    tenant: TenantContext = Depends(require_tenant),
) -> GenerateResponse:
    started_at = time.monotonic()
    user_request = payload.user_request.strip()
    image_url = str(payload.image_url)
    brand = payload.brand
    duration = payload.duration

    request_payload = {
        "brand": brand,
        "user_request": user_request,
        "image_url": image_url,
        "duration": duration,
    }

    config_override = await get_brand_agent_config(
        brand_id=tenant.brand_id, agent_kind=AGENT_KIND
    )
    if config_override is None:
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload=request_payload,
            error_code="agent_not_published",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This brand has not enabled the video agent.",
        )

    if not await consume_quota(
        brand_id=tenant.brand_id, agent_kind=AGENT_KIND, cost_cents=COST_CENTS_PER_RUN
    ):
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload=request_payload,
            error_code="quota_exceeded",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Monthly quota for this brand is exhausted.",
        )

    try:
        motion_prompt = _build_motion_prompt(
            user_request,
            image_url,
            brand,
            system_prompt_override=config_override.get("system_prompt_override"),
        )
        _, video_url = run_video_prediction(
            prompt=motion_prompt,
            image_url=image_url,
            duration=duration,
        )
    except RuntimeError as runtime_error:
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload=request_payload,
            error_code="upstream_failure",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        logger.warning("External video generation failed: %s", runtime_error)
        detail = sanitize_provider_message(
            str(runtime_error),
            "Video generation failed upstream. Please retry shortly.",
        )
        status_code = (
            status.HTTP_500_INTERNAL_SERVER_ERROR
            if "not configured" in str(runtime_error)
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=status_code, detail=detail) from runtime_error
    except Exception as exc:
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload=request_payload,
            error_code="unexpected",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        logger.exception("Unexpected server error during external video generation.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected server error.",
        ) from exc

    await record_run(
        tenant=tenant,
        agent_kind=AGENT_KIND,
        status_value="succeeded",
        request_payload=request_payload,
        response_payload={"video_url": video_url, "prompt": motion_prompt, "duration": duration},
        cost_usd=COST_CENTS_PER_RUN / 100.0,
        duration_ms=int((time.monotonic() - started_at) * 1000),
    )
    return GenerateResponse(
        video_url=video_url,
        prompt=motion_prompt,
        brand=brand,
        duration=duration,
    )
