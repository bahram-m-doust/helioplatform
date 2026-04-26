"""Public request/response schemas for the external campaign-maker API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.external.config import CONFIG


ChatRole = Literal["user", "assistant"]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str = Field(..., min_length=1, max_length=CONFIG.max_message_chars)


class ChatRequest(BaseModel):
    brand: Literal["Mansory", "Technogym", "Binghatti"] = Field(
        default="Mansory",
        description="Brand profile that selects the underlying campaign system prompt.",
    )
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
        if len(value) > CONFIG.max_messages:
            raise ValueError(
                f"messages may contain at most {CONFIG.max_messages} entries.",
            )
        if not any(m.role == "user" and m.content.strip() for m in value):
            raise ValueError("At least one non-empty user message is required.")
        return value


class ChatResponse(BaseModel):
    status: Literal["ok"] = "ok"
    brand: str
    reply: str
