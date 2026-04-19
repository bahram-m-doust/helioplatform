from fastapi import APIRouter

from app.config import SERVICE_NAME

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}


@router.get("/")
def root() -> dict[str, str]:
    return {"service": SERVICE_NAME, "docs": "/docs"}
