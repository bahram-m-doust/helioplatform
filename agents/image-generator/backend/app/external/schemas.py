"""Public request/response schemas for the external image-generator API.

Keep these intentionally narrower than the internal ``app.api`` models:
external clients should not see internal field names, model identifiers,
or provider-specific metadata. Field length caps come from
``ExternalConfig`` so a single env var can tighten or relax them.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.external.config import MAX_REFERENCE_IMAGES, MAX_USER_REQUEST_CHARS


_ALLOWED_BRANDS = {"general", "mansory", "technogym", "binghatti"}


class GenerateRequest(BaseModel):
    """Single-call generation: prompt is built and rendered server-side."""

    user_request: str = Field(
        ...,
        min_length=3,
        max_length=MAX_USER_REQUEST_CHARS,
        description="Plain-English description of what the image should show.",
    )
    brand: Literal["General", "Mansory", "Technogym", "Binghatti"] = Field(
        default="General",
        description="Brand profile that shapes the visual style.",
    )
    reference_images: list[HttpUrl] = Field(
        default_factory=list,
        description="Optional reference image URLs (https only).",
    )

    @field_validator("brand", mode="before")
    @classmethod
    def _normalize_brand(cls, value: str) -> str:
        cleaned = (value or "General").strip().title()
        if cleaned.lower() not in _ALLOWED_BRANDS:
            return "General"
        return cleaned

    @field_validator("reference_images")
    @classmethod
    def _cap_references(cls, value: list[HttpUrl]) -> list[HttpUrl]:
        if len(value) > MAX_REFERENCE_IMAGES:
            raise ValueError(
                f"reference_images supports up to {MAX_REFERENCE_IMAGES} URLs."
            )
        return value


class GenerateResponse(BaseModel):
    status: Literal["succeeded"] = "succeeded"
    image_url: str = Field(..., description="URL of the generated image asset.")
    prompt: str = Field(..., description="Final prompt that was rendered.")
    brand: str
