"""External (public) routes for the image-generator agent.

Surface area is intentionally minimal: a single ``POST /generate`` that
hides the two-step prompt-then-render flow from external callers. They
get back the prompt that was used so they can show it in their UI.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.external.schemas import GenerateRequest, GenerateResponse
from app.external.security import require_caller
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

router = APIRouter(prefix="/v1", tags=["external:image"])


def _build_prompt(user_request: str, brand: str) -> str:
    brand_context = BRAND_CONTEXT.get(brand.lower(), DEFAULT_BRAND_CONTEXT)
    messages = [
        {"role": "system", "content": image_prompt_system()},
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
def generate(
    payload: GenerateRequest,
    principal: str = Depends(require_caller),
) -> GenerateResponse:
    user_request = payload.user_request.strip()
    brand = payload.brand
    image_inputs = [str(url) for url in payload.reference_images]

    try:
        final_prompt = _build_prompt(user_request, brand)
        _, image_url = run_image_prediction(prompt=final_prompt, image_input=image_inputs)
    except RuntimeError as runtime_error:
        logger.warning(
            "External image generation failed for principal=%s: %s",
            principal,
            runtime_error,
        )
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
        logger.exception("Unexpected server error during external image generation.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected server error.",
        ) from exc

    return GenerateResponse(image_url=image_url, prompt=final_prompt, brand=brand)
