"""Video agent HTTP routes.

- POST /api/image-prompt       -> keyframe image prompt via OpenRouter.
- POST /api/prompt-from-image  -> Kling motion prompt from an image via OpenRouter (vision).
- POST /api/generate           -> image-to-video generation via Replicate (Kling).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.openrouter import openrouter_chat
from app.services.prompts import (
    fallback_image_prompt,
    fallback_video_prompt,
    kling_system_prompt,
    prompt_repair_system,
    video_image_prompt_system,
)
from app.services.replicate import run_video_prediction
from app.services.sanitize import looks_like_instruction_dump, sanitize_provider_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["video"])


class ImagePromptRequest(BaseModel):
    user_request: str = ""
    brand: str = "General"


class ImagePromptResponse(BaseModel):
    status: str = "ok"
    image_prompt: str


class PromptFromImageRequest(BaseModel):
    user_request: str = ""
    image_url: str = ""
    brand: str = "General"


class PromptFromImageResponse(BaseModel):
    status: str = "ok"
    video_prompt: str


class GenerateRequest(BaseModel):
    video_prompt: str = ""
    image_url: str = ""
    duration: int = Field(default=5, ge=1, le=60)


class GenerateResponse(BaseModel):
    status: str = "succeeded"
    prediction_id: str | None = None
    video_url: str


def _repair_prompt_output(kind: str, brand: str, user_request: str, raw_output: str) -> str:
    messages = [
        {"role": "system", "content": prompt_repair_system()},
        {
            "role": "user",
            "content": (
                f"Task kind: {kind}\n"
                f"Brand: {brand}\n"
                f"User request: {user_request}\n"
                "Rewrite the leaked output below into one final production-ready prompt line.\n"
                "Leaked output:\n"
                f"{raw_output[:6000]}"
            ),
        },
    ]
    repaired = openrouter_chat(messages, max_tokens=260, temperature=0.2)
    return " ".join(repaired.split()).strip()


@router.post("/image-prompt", response_model=ImagePromptResponse)
def image_prompt_endpoint(payload: ImagePromptRequest) -> ImagePromptResponse:
    user_request = (payload.user_request or "").strip()
    brand = (payload.brand or "General").strip()
    if not user_request:
        raise HTTPException(status_code=400, detail="user_request is required.")

    try:
        messages = [
            {"role": "system", "content": video_image_prompt_system()},
            {
                "role": "user",
                "content": (
                    f"Brand: {brand}\n"
                    f"User request: {user_request}\n"
                    "Generate one final image prompt suitable for premium marketing visuals."
                ),
            },
        ]
        image_prompt = openrouter_chat(messages, max_tokens=500, temperature=0.5)
        if looks_like_instruction_dump(image_prompt):
            logger.warning("Detected instruction dump in image prompt output. Attempting repair.")
            image_prompt = _repair_prompt_output("image", brand, user_request, image_prompt)
        if looks_like_instruction_dump(image_prompt) or not image_prompt.strip():
            logger.warning("Image prompt output still invalid after repair. Using fallback prompt.")
            image_prompt = fallback_image_prompt(brand, user_request)
        return ImagePromptResponse(image_prompt=image_prompt)
    except RuntimeError as runtime_error:
        logger.warning("Video image-prompt generation failed: %s", runtime_error)
        raise HTTPException(
            status_code=502,
            detail=sanitize_provider_message(
                str(runtime_error),
                "Image prompt generation failed upstream. Please retry in a few seconds.",
            ),
        ) from runtime_error
    except Exception as exc:
        logger.exception("Unexpected server error while generating image prompt.")
        raise HTTPException(status_code=500, detail="Unexpected server error while generating image prompt.") from exc


@router.post("/prompt-from-image", response_model=PromptFromImageResponse)
def prompt_from_image(payload: PromptFromImageRequest) -> PromptFromImageResponse:
    user_request = (payload.user_request or "").strip()
    image_url = (payload.image_url or "").strip()
    brand = (payload.brand or "General").strip()
    if not user_request:
        raise HTTPException(status_code=400, detail="user_request is required.")
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url is required.")

    try:
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
                            "Create one Kling-ready motion prompt in English for image-to-video generation.\n"
                            "Return only the final prompt text."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url},
                    },
                ],
            },
        ]
        video_prompt = openrouter_chat(messages, max_tokens=600, temperature=0.35)
        if looks_like_instruction_dump(video_prompt):
            logger.warning("Detected instruction dump in video prompt output. Attempting repair.")
            video_prompt = _repair_prompt_output("video", brand, user_request, video_prompt)
        if looks_like_instruction_dump(video_prompt) or not video_prompt.strip():
            logger.warning("Video prompt output still invalid after repair. Using fallback prompt.")
            video_prompt = fallback_video_prompt(brand, user_request)
        return PromptFromImageResponse(video_prompt=video_prompt)
    except RuntimeError as runtime_error:
        logger.warning("Video prompt-from-image generation failed: %s", runtime_error)
        raise HTTPException(
            status_code=502,
            detail=sanitize_provider_message(
                str(runtime_error),
                "Video prompt extraction failed upstream. Please retry in a few seconds.",
            ),
        ) from runtime_error
    except Exception as exc:
        logger.exception("Unexpected server error while generating video prompt.")
        raise HTTPException(status_code=500, detail="Unexpected server error while generating video prompt.") from exc


@router.post("/generate", response_model=GenerateResponse)
def generate_video(payload: GenerateRequest) -> GenerateResponse:
    video_prompt = (payload.video_prompt or "").strip()
    image_url = (payload.image_url or "").strip()
    if not video_prompt:
        raise HTTPException(status_code=400, detail="video_prompt is required.")
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url is required.")

    try:
        prediction_id, video_url = run_video_prediction(
            prompt=video_prompt,
            image_url=image_url,
            duration=payload.duration,
        )
        return GenerateResponse(
            status="succeeded",
            prediction_id=prediction_id or None,
            video_url=video_url,
        )
    except RuntimeError as runtime_error:
        logger.warning("Video generation failed: %s", runtime_error)
        detail = sanitize_provider_message(
            str(runtime_error),
            "Video rendering failed upstream. Please retry in a few seconds.",
        )
        status_code = 500 if "not configured" in str(runtime_error) else 502
        raise HTTPException(status_code=status_code, detail=detail) from runtime_error
    except Exception as exc:
        logger.exception("Unexpected server error during video generation.")
        raise HTTPException(status_code=500, detail="Unexpected server error during video generation.") from exc
