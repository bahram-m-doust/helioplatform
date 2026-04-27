"""External (public) routes for the campaign-maker agent."""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, status

from agent_common.tenant import (
    TenantContext,
    consume_quota,
    get_brand_agent_config,
    record_run,
)

from app.external.config import DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from app.external.schemas import ChatRequest, ChatResponse
from app.external.security import require_tenant
from app.services.openrouter import openrouter_chat_with_fallbacks
from app.services.prompts import resolve_brand_prompt

logger = logging.getLogger(__name__)

AGENT_KIND = "campaign"
COST_CENTS_PER_RUN = 2

router = APIRouter(prefix="/v1", tags=["external:campaign-maker"])


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Run a Campaign Maker turn against the selected brand profile.",
)
async def chat(
    payload: ChatRequest,
    tenant: TenantContext = Depends(require_tenant),
) -> ChatResponse:
    started_at = time.monotonic()
    brand = payload.brand

    request_payload = {"brand": brand, "message_count": len(payload.messages)}

    config_override = await get_brand_agent_config(
        brand_id=tenant.brand_id, agent_kind=AGENT_KIND
    )
    if config_override is None:
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload=request_payload,
            error_code="agent_not_published",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This brand has not enabled the campaign-maker agent.",
        )

    system_prompt = config_override.get("system_prompt_override") or resolve_brand_prompt(brand)
    if system_prompt is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown brand '{brand}'.",
        )

    if not await consume_quota(
        brand_id=tenant.brand_id, agent_kind=AGENT_KIND, cost_cents=COST_CENTS_PER_RUN
    ):
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload=request_payload,
            error_code="quota_exceeded",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Monthly quota for this brand is exhausted.",
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
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload=request_payload,
            error_code="upstream_failure",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        logger.warning("External campaign-maker chat failed: %s", runtime_error)
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
        await record_run(
            tenant=tenant,
            agent_kind=AGENT_KIND,
            status_value="failed",
            request_payload=request_payload,
            error_code="unexpected",
            duration_ms=int((time.monotonic() - started_at) * 1000),
        )
        logger.exception("Unexpected server error during external campaign-maker chat.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected server error.",
        ) from exc

    await record_run(
        tenant=tenant,
        agent_kind=AGENT_KIND,
        status_value="succeeded",
        request_payload=request_payload,
        cost_usd=COST_CENTS_PER_RUN / 100.0,
        duration_ms=int((time.monotonic() - started_at) * 1000),
    )
    return ChatResponse(brand=brand, reply=reply)
