"""Soul-print internal chat route.

POST /api/chat — runs one Soul Print turn against OpenRouter using the
single ``Soul Print`` system prompt. Multi-turn support is provided by
having the caller resend the full transcript on each request (same as
storyteller / campaign-maker).
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.openrouter import openrouter_chat_with_fallbacks
from app.services.prompts import soul_print_system_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["soul-print"])

ChatRole = Literal["user", "assistant", "system"]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    max_tokens: int | None = Field(default=None, ge=1, le=4000)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)


class ChatResponse(BaseModel):
    status: str = "ok"
    reply: str


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty.")
    if not any(m.role == "user" and m.content.strip() for m in payload.messages):
        raise HTTPException(status_code=400, detail="At least one user message is required.")

    conversation = [{"role": "system", "content": soul_print_system_prompt()}]
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
            max_tokens=payload.max_tokens or 1200,
            temperature=payload.temperature if payload.temperature is not None else 0.65,
            service_title="Helio Soul Print",
        )
    except RuntimeError as runtime_error:
        logger.warning("Soul Print chat failed: %s", runtime_error)
        message = str(runtime_error)
        status_code = 500 if "not configured" in message else 502
        raise HTTPException(
            status_code=status_code,
            detail="Soul Print is temporarily unavailable. Please retry shortly.",
        ) from runtime_error
    except Exception as exc:
        logger.exception("Unexpected error during Soul Print chat.")
        raise HTTPException(
            status_code=500,
            detail="Unexpected server error while running Soul Print.",
        ) from exc

    return ChatResponse(reply=reply)
