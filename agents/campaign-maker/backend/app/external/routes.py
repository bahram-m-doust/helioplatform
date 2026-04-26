"""External (public) routes for the campaign-maker agent."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.external.config import DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from app.external.schemas import ChatRequest, ChatResponse
from app.external.security import require_caller
from app.services.openrouter import openrouter_chat_with_fallbacks
from app.services.prompts import resolve_brand_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["external:campaign-maker"])


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Run a Campaign Maker turn against the selected brand profile.",
)
def chat(
    payload: ChatRequest,
    principal: str = Depends(require_caller),
) -> ChatResponse:
    brand = payload.brand
    system_prompt = resolve_brand_prompt(brand)
    if system_prompt is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown brand '{brand}'.",
        )

    conversation = [{"role": "system", "content": system_prompt}]
    for message in payload.messages:
        content = message.content.strip()
        if not content:
            continue
        conversation.append({"role": message.role, "content": content})

    try:
        reply = openrouter_chat_with_fallbacks(
            conversation,
            max_tokens=payload.max_tokens or DEFAULT_MAX_TOKENS,
            temperature=(
                payload.temperature
                if payload.temperature is not None
                else DEFAULT_TEMPERATURE
            ),
            service_title="Helio Campaign Maker (external)",
        )
    except RuntimeError as runtime_error:
        logger.warning(
            "External campaign-maker chat failed for principal=%s: %s",
            principal,
            runtime_error,
        )
        message = str(runtime_error)
        status_code = (
            status.HTTP_500_INTERNAL_SERVER_ERROR
            if "not configured" in message
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(
            status_code=status_code,
            detail="Campaign Maker is temporarily unavailable. Please retry shortly.",
        ) from runtime_error
    except Exception as exc:
        logger.exception("Unexpected server error during external campaign-maker chat.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected server error.",
        ) from exc

    return ChatResponse(brand=brand, reply=reply)
