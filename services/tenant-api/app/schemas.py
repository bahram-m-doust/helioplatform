"""Public request/response models for the tenant-api service."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


_SLUG_RE = re.compile(r'^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$')


class BrandCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=32, examples=['binghatti'])
    display_name: str = Field(..., min_length=2, max_length=120)

    @field_validator('slug')
    @classmethod
    def _validate_slug(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _SLUG_RE.match(normalized):
            raise ValueError(
                'slug must be 2-32 chars: lowercase letters, digits, single hyphens.',
            )
        return normalized


class BrandRead(BaseModel):
    id: UUID
    slug: str
    display_name: str
    status: Literal['active', 'suspended', 'archived']
    created_at: datetime


class MembershipRead(BaseModel):
    brand_id: UUID
    slug: str
    display_name: str
    role: Literal['owner', 'editor', 'viewer']


class ApiKeyCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)


class ApiKeyIssued(BaseModel):
    """Returned exactly once at issuance — never persisted in plaintext."""

    id: UUID
    brand_id: UUID
    label: str
    secret: str = Field(..., description='Plaintext secret. Store immediately; we cannot show it again.')
    prefix: str
    created_at: datetime


class ApiKeyRead(BaseModel):
    id: UUID
    label: str
    prefix: str
    created_at: datetime
    revoked_at: datetime | None
    last_used_at: datetime | None


class SubdomainCreate(BaseModel):
    subdomain: str = Field(..., min_length=2, max_length=32, examples=['binghatti'])

    @field_validator('subdomain')
    @classmethod
    def _validate(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _SLUG_RE.match(normalized):
            raise ValueError('subdomain must be a valid DNS label (a-z, 0-9, hyphen).')
        return normalized


class HealthResponse(BaseModel):
    status: Literal['ok'] = 'ok'
    service: str
    supabase_configured: bool
