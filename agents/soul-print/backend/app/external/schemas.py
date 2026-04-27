"""Public request/response schemas for the external soul-print API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.external.config import MAX_MESSAGE_CHARS, MAX_MESSAGES


ChatRole = Literal["user", "assistant"]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(
        ...,
        min_length=1,
        description="Conversation so far. Must contain at least one user message.",
    )
    max_tokens: int | None = Field(default=None, ge=1, le=4000)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)

    @field_validator("messages")
    @classmethod
    def _cap_history_and_require_user(cls, value: list[ChatMessage]) -> list[ChatMessage]:
        if len(value) > MAX_MESSAGES:
            raise ValueError(
                f"messages may contain at most {MAX_MESSAGES} entries.",
            )
        if not any(m.role == "user" and m.content.strip() for m in value):
            raise ValueError("At least one non-empty user message is required.")
        return value


class ChatResponse(BaseModel):
    status: Literal["ok"] = "ok"
    reply: str
