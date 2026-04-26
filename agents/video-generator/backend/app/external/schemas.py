"""Public request/response schemas for the external video-generator API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.external.config import CONFIG


_ALLOWED_BRANDS = {"general", "mansory", "technogym", "binghatti"}


class GenerateRequest(BaseModel):
    """One-call image-to-video. Caller supplies a still + a description."""

    user_request: str = Field(
        ...,
        min_length=3,
        max_length=CONFIG.max_user_request_chars,
        description="Short scene/motion description.",
    )
    image_url: HttpUrl = Field(
        ...,
        description="Keyframe image URL (https). The animation starts from this frame.",
    )
    brand: Literal["General", "Mansory", "Technogym", "Binghatti"] = "General"
    duration: int = Field(
        default=5,
        ge=CONFIG.min_duration,
        le=CONFIG.max_duration,
        description="Duration in seconds.",
    )

    @field_validator("brand", mode="before")
    @classmethod
    def _normalize_brand(cls, value: str) -> str:
        cleaned = (value or "General").strip().title()
        if cleaned.lower() not in _ALLOWED_BRANDS:
            return "General"
        return cleaned


class GenerateResponse(BaseModel):
    status: Literal["succeeded"] = "succeeded"
    video_url: str
    prompt: str
    brand: str
    duration: int
