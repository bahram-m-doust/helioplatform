"""External (public) routes for the image-generator agent.

Single ``POST /generate`` that hides the two-step prompt-then-render
flow from external callers. The caller's tenant context (brand_id,
optional user_id, optional api_key_id) is resolved by ``require_tenant``
and passed through to per-brand prompt overrides, quota enforcement,
and audit logging.
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
    BRAND_CONTEXT,
    DEFAULT_BRAND_CONTEXT,
    fallback_subject_first_prompt,
    image_prompt_system,
    prompt_repair_system,
)
from app.services.replicate import run_image_prediction
from app.services.sanitize import looks_like_prompt_dump, sanitize_provider_message

logger = logging.getLogger(__name__)

AGENT_KIND = "image"

# Heuristic cost-cents per Seedream call. Operators tighten this in the
# brand_quotas budget; if their actual provider cost differs, they tune
# the budget accordingly. Keeping the cost constant per agent here keeps
# the quota arithmetic deterministic without round-tripping to the
# provider for billing details.
COST_CENTS_PER_RUN = 8

router = APIRouter(prefix="/v1", tags=["external:image"])


def _build_prompt(
    user_request: str,
    brand: str,
    *,
    system_prompt_override: str | None,
) -> str:
    brand_context = BRAND_CONTEXT.get(brand.lower(), DEFAULT_BRAND_CONTEXT)
    system_prompt = system_prompt_override or image_prompt_system()
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"Brand: {brand}\n"
                f"Brand context: {brand_context}\n"
                f"User request: {user_request}\n"
                "Generate one final prompt for Seedream 4.5. Keep the user subject as hero."
            ),
        },
    ]
    final_prompt = openrouter_chat(
        messages,
        max_tokens=420,
        temperature=0.45,
        service_title="Helio Image Generator (external)",
    )
    if looks_like_prompt_dump(final_prompt):
        repaired = openrouter_chat(
            [
                {"role": "system", "content": prompt_repair_system()},
                {
                    "role": "user",
                    "content": (
                        f"Brand: {brand}\n"
                        f"User request: {user_request}\n"
                        "Rewrite the leaked output below into one final image prompt line.\n"
                        f"Leaked output:\n{final_prompt[:6000]}"
                    ),
                },
            ],
            max_tokens=260,
            temperature=0.2,
            service_title="Helio Image Generator (external)",
        )
        final_prompt = " ".join(repaired.split()).strip()
    if looks_like_prompt_dump(final_prompt) or not final_prompt.strip():
        final_prompt = fallback_subject_first_prompt(brand, user_request)
    return final_prompt


@router.post(
    "/generate",
    response_model=GenerateResponse,
    summary="Generate an image from a plain-English description.",
)
async def generate(
    payload: GenerateRequest,
    tenant: TenantContext = Depends(require_tenant),
) -> GenerateResponse:
    started_at = time.monotonic()
    user_request = payload.user_request.strip()
    brand = payload.brand
    image_inputs = [str(url) for url in payload.reference_images]

    # Per-brand override: caller's brand_agents row may have an
    # alternative system_prompt_override or a hard-disable flag. In
    # legacy mode the helper returns {} so we fall through to the
    # static defaults.
    config_override = await get_brand_agent_config(
        brand_id=tenant.brand_id, agent_kind=AGENT_KIND
    )
    if config_override is None:
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload={"brand": brand, "user_request": user_request},
            error_code="agent_not_published",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This brand has not enabled the image agent.",
        )

    # Quota gate: budget=0 means unlimited; helper consumes the cost
    # atomically and returns False if blocked.
    if not await consume_quota(
        brand_id=tenant.brand_id, agent_kind=AGENT_KIND, cost_cents=COST_CENTS_PER_RUN
    ):
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload={"brand": brand, "user_request": user_request},
            error_code="quota_exceeded",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Monthly quota for this brand is exhausted.",
        )

    try:
        final_prompt = _build_prompt(
            user_request,
            brand,
            system_prompt_override=config_override.get("system_prompt_override"),
        )
        _, image_url = run_image_prediction(prompt=final_prompt, image_input=image_inputs)
    except RuntimeError as runtime_error:
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload={"brand": brand, "user_request": user_request},
            error_code="upstream_failure",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        logger.warning("External image generation failed: %s", runtime_error)
        detail = sanitize_provider_message(
            str(runtime_error),
            "Image generation failed upstream. Please retry shortly.",
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
            request_payload={"brand": brand, "user_request": user_request},
            error_code="unexpected",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        logger.exception("Unexpected server error during external image generation.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected server error.",
        ) from exc

    await record_run(
        tenant=tenant,
        agent_kind=AGENT_KIND,
        status_value="succeeded",
        request_payload={"brand": brand, "user_request": user_request},
        response_payload={"image_url": image_url, "prompt": final_prompt},
        cost_usd=COST_CENTS_PER_RUN / 100.0,
        duration_ms=int((time.monotonic() - started_at) * 1000),
    )
    return GenerateResponse(image_url=image_url, prompt=final_prompt, brand=brand)
