"""Campaign Maker chat route.

POST /api/chat     -> run a Campaign Maker turn against OpenRouter using the
                      system prompt associated with the requested brand.
GET  /api/brands   -> list of brand profiles the service will accept.

The frontend never sees the system prompt: it only sends the brand label
and the conversation so far.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.openrouter import openrouter_chat_with_fallbacks
from app.services.prompts import available_brands, resolve_brand_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["campaign-maker"])

ChatRole = Literal["user", "assistant", "system"]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str


class ChatRequest(BaseModel):
    brand: str = Field(default="Mansory", description="Brand profile label.")
    messages: list[ChatMessage] = Field(default_factory=list)
    max_tokens: int | None = Field(default=None, ge=1, le=4000)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)


class ChatResponse(BaseModel):
    status: str = "ok"
    brand: str
    reply: str


class BrandsResponse(BaseModel):
    brands: list[str]


@router.get("/brands", response_model=BrandsResponse)
def list_brands() -> BrandsResponse:
    return BrandsResponse(brands=available_brands())


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    brand = (payload.brand or "").strip()
    system_prompt = resolve_brand_prompt(brand)
    if system_prompt is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown brand '{brand}'. Supported brands: "
                f"{', '.join(available_brands())}."
            ),
        )

    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty.")

    if not any(msg.role == "user" and msg.content.strip() for msg in payload.messages):
        raise HTTPException(status_code=400, detail="At least one user message is required.")

    conversation = [{"role": "system", "content": system_prompt}]
    for message in payload.messages:
        if message.role == "system":
            continue
        content = (message.content or "").strip()
        if not content:
            continue
        conversation.append({"role": message.role, "content": content})

    try:
        reply = openrouter_chat_with_fallbacks(
            conversation,
            max_tokens=payload.max_tokens or 900,
            temperature=payload.temperature if payload.temperature is not None else 0.7,
            service_title="Helio Campaign Maker",
        )
    except RuntimeError as runtime_error:
        logger.warning("Campaign Maker chat failed: %s", runtime_error)
        message = str(runtime_error)
        status_code = 500 if "not configured" in message else 502
        raise HTTPException(
            status_code=status_code,
            detail="Campaign Maker is temporarily unavailable. Please retry shortly.",
        ) from runtime_error
    except Exception as exc:
        logger.exception("Unexpected error during campaign-maker chat.")
        raise HTTPException(
            status_code=500,
            detail="Unexpected server error while generating the campaign.",
        ) from exc

    return ChatResponse(brand=brand, reply=reply)
