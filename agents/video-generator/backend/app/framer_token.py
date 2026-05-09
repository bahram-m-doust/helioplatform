import os

import jwt
from jwt.exceptions import InvalidTokenError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

JWT_SECRET = (os.getenv("FRAMER_JWT_SECRET") or "").strip()
EXPECTED_TOOL = (os.getenv("FRAMER_EMBED_TOOL") or "").strip()


class FramerEmbedMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        path = request.url.path
        if path in ("/health", "/") or path.startswith("/docs") or path in ("/openapi.json", "/redoc"):
            return await call_next(request)
        auth = request.headers.get("authorization")
        if not auth:
            return await call_next(request)
        if not auth.startswith("Bearer "):
            return JSONResponse({"detail": "Invalid Authorization header"}, status_code=403)
        if not JWT_SECRET or not EXPECTED_TOOL:
            return JSONResponse(
                {"detail": "Server embed token validation is not configured."},
                status_code=503,
            )
        raw = auth[7:].strip()
        try:
            payload = jwt.decode(raw, JWT_SECRET, algorithms=["HS256"])
        except InvalidTokenError:
            return JSONResponse({"detail": "Invalid or expired embed token"}, status_code=403)
        grants = payload.get("grants")
        if not isinstance(grants, list):
            legacy = payload.get("tool")
            grants = [legacy] if legacy else []
        if EXPECTED_TOOL not in grants or payload.get("sub") != "framer":
            return JSONResponse({"detail": "Embed token scope mismatch"}, status_code=403)
        return await call_next(request)
