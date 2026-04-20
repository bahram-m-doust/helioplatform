"""Storyteller agent chat route.

POST /api/chat -> run a Storyteller turn against OpenRouter using the
system prompt associated with the requested profile.

The frontend never sees the system prompt: it only sends a profile name
(``Brand Language`` or ``Language Style``) and the conversation so far.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.openrouter import openrouter_chat_with_fallbacks
from app.services.prompts import available_profiles, resolve_profile_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["storyteller"])

ChatRole = Literal["user", "assistant", "system"]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str


class ChatRequest(BaseModel):
    profile: str = Field(default="Brand Language", description="Profile label.")
    messages: list[ChatMessage] = Field(default_factory=list)
    max_tokens: int | None = Field(default=None, ge=1, le=4000)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)


class ChatResponse(BaseModel):
    status: str = "ok"
    profile: str
    reply: str


class ProfilesResponse(BaseModel):
    profiles: list[str]


@router.get("/profiles", response_model=ProfilesResponse)
def list_profiles() -> ProfilesResponse:
    return ProfilesResponse(profiles=available_profiles())


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    profile = (payload.profile or "").strip()
    system_prompt = resolve_profile_prompt(profile)
    if system_prompt is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown profile '{profile}'. Supported profiles: "
                f"{', '.join(available_profiles())}."
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
            service_title="Helio Storyteller",
        )
    except RuntimeError as runtime_error:
        logger.warning("Storyteller chat failed: %s", runtime_error)
        message = str(runtime_error)
        status_code = 500 if "not configured" in message else 502
        raise HTTPException(
            status_code=status_code,
            detail="Storyteller is temporarily unavailable. Please retry shortly.",
        ) from runtime_error
    except Exception as exc:
        logger.exception("Unexpected error during storyteller chat.")
        raise HTTPException(
            status_code=500,
            detail="Unexpected server error while generating the story.",
        ) from exc

    return ChatResponse(profile=profile, reply=reply)
