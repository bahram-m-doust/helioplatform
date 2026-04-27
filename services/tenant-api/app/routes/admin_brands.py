"""Admin-only brand routes.

These bypass RLS via the service-role httpx client (see security.py).
Only callers with ``app_metadata.role == 'helio_admin'`` reach these
endpoints; the ``require_admin`` dependency enforces that.
"""

from __future__ import annotations

import secrets
from hashlib import sha256
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas import (
    ApiKeyCreate,
    ApiKeyIssued,
    BrandCreate,
    BrandRead,
    SubdomainCreate,
)
from app.security import AuthPrincipal, require_admin, supabase_admin_client

router = APIRouter(prefix='/admin', tags=['admin'])

# Customer-facing keys are prefixed so support staff can identify them
# without ever seeing the secret. Format: ``helio_live_<32-byte-urlsafe>``.
_KEY_PREFIX = 'helio_live_'


def _new_secret() -> str:
    return _KEY_PREFIX + secrets.token_urlsafe(32)


@router.post('/brands', response_model=BrandRead, status_code=status.HTTP_201_CREATED)
async def create_brand(
    payload: BrandCreate,
    admin: AuthPrincipal = Depends(require_admin),
) -> BrandRead:
    """Create a brand. The admin becomes the initial owner."""
    client = supabase_admin_client()
    response = await client.post(
        '/rest/v1/brands',
        json={
            'slug': payload.slug,
            'display_name': payload.display_name,
            'owner_user_id': admin.user_id,
        },
    )
    if response.status_code == 409 or response.status_code == 23505:
        raise HTTPException(status.HTTP_409_CONFLICT, f'slug "{payload.slug}" already taken.')
    if response.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, 'Failed to create brand upstream.')
    rows = response.json()
    brand = rows[0] if isinstance(rows, list) else rows

    # Add admin as owner-membership row in the same control-plane operation.
    member_response = await client.post(
        '/rest/v1/brand_members',
        json={'brand_id': brand['id'], 'user_id': admin.user_id, 'role': 'owner'},
    )
    if member_response.status_code >= 400:
        # Best-effort cleanup: orphan brand left behind. Surface for support.
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            'Brand created but membership write failed; contact support.',
        )

    return BrandRead(**brand)


@router.get('/brands', response_model=list[BrandRead])
async def list_brands(_admin: AuthPrincipal = Depends(require_admin)) -> list[BrandRead]:
    client = supabase_admin_client()
    response = await client.get('/rest/v1/brands', params={'select': '*'})
    if response.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, 'Failed to list brands.')
    return [BrandRead(**row) for row in response.json()]


@router.post(
    '/brands/{brand_id}/api-keys',
    response_model=ApiKeyIssued,
    status_code=status.HTTP_201_CREATED,
)
async def issue_api_key(
    brand_id: UUID,
    payload: ApiKeyCreate,
    admin: AuthPrincipal = Depends(require_admin),
) -> ApiKeyIssued:
    """Issue a new server-to-server key. Plaintext returned exactly once."""
    secret = _new_secret()
    key_hash = sha256(secret.encode('utf-8')).digest()
    prefix = secret[:8]

    client = supabase_admin_client()
    response = await client.post(
        '/rest/v1/brand_api_keys',
        json={
            'brand_id': str(brand_id),
            'label': payload.label,
            # PostgREST accepts hex-encoded bytea via the \\x prefix.
            'key_hash': '\\x' + key_hash.hex(),
            'prefix': prefix,
            'created_by': admin.user_id,
        },
    )
    if response.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, 'Failed to issue API key.')
    row = response.json()[0]
    return ApiKeyIssued(
        id=row['id'],
        brand_id=row['brand_id'],
        label=row['label'],
        secret=secret,  # Only time we ever return this in plaintext.
        prefix=row['prefix'],
        created_at=row['created_at'],
    )


@router.post(
    '/brands/{brand_id}/subdomains',
    status_code=status.HTTP_201_CREATED,
)
async def add_subdomain(
    brand_id: UUID,
    payload: SubdomainCreate,
    _admin: AuthPrincipal = Depends(require_admin),
) -> dict:
    """Record a subdomain provisioned manually in Framer's UI."""
    client = supabase_admin_client()
    response = await client.post(
        '/rest/v1/brand_subdomains',
        json={'brand_id': str(brand_id), 'subdomain': payload.subdomain},
    )
    if response.status_code == 409:
        raise HTTPException(status.HTTP_409_CONFLICT, 'Subdomain already exists for some brand.')
    if response.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, 'Failed to add subdomain.')
    return {'status': 'ok', 'subdomain': payload.subdomain, 'brand_id': str(brand_id)}
