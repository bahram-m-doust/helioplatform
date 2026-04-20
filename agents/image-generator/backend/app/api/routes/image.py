"""Image agent HTTP routes.

- POST /api/prompt     -> generate a final image prompt via OpenRouter.
- POST /api/generate   -> run the image prompt through Replicate (Seedream).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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
