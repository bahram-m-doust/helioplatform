"""External (public) routes for the video-generator agent.

A single ``POST /generate`` endpoint hides the internal three-step flow
(image-prompt -> motion-prompt -> render). Callers supply the keyframe
image and a description; we return the rendered video URL plus the
motion prompt that was used.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.external.schemas import GenerateRequest, GenerateResponse
from app.external.security import require_caller
from app.services.openrouter import openrouter_chat
from app.services.prompts import (
    fallback_video_prompt,
    kling_system_prompt,
    prompt_repair_system,
)
from app.services.replicate import run_video_prediction
from app.services.sanitize import looks_like_instruction_dump, sanitize_provider_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["external:video"])


def _build_motion_prompt(user_request: str, image_url: str, brand: str) -> str:
    messages = [
        {"role": "system", "content": kling_system_prompt()},
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
def generate(
    payload: GenerateRequest,
    principal: str = Depends(require_caller),
) -> GenerateResponse:
    user_request = payload.user_request.strip()
    image_url = str(payload.image_url)
    brand = payload.brand
    duration = payload.duration

    try:
        motion_prompt = _build_motion_prompt(user_request, image_url, brand)
        _, video_url = run_video_prediction(
            prompt=motion_prompt,
            image_url=image_url,
            duration=duration,
        )
    except RuntimeError as runtime_error:
        logger.warning(
            "External video generation failed for principal=%s: %s",
            principal,
            runtime_error,
        )
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
        logger.exception("Unexpected server error during external video generation.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected server error.",
        ) from exc

    return GenerateResponse(
        video_url=video_url,
        prompt=motion_prompt,
        brand=brand,
        duration=duration,
    )
