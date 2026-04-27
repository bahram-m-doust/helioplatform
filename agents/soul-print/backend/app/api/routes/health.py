"""Liveness probe + welcome-message endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import SERVICE_NAME
from app.services.prompts import WELCOME_MESSAGE

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME}


@router.get("/")
def root() -> dict:
    return {"service": SERVICE_NAME, "docs": "/docs"}


@router.get("/api/welcome")
def welcome() -> dict:
    """Return the canonical welcome message used by the test UI."""
    return {"welcome": WELCOME_MESSAGE}
