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
    FramerInviteRequest,
    FramerInviteResponse,
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


framer_router = APIRouter(prefix='/framer', tags=['framer'])


@framer_router.post(
    '/invite',
    response_model=FramerInviteResponse,
    status_code=status.HTTP_201_CREATED,
    summary='Invite a Framer user to a brand and pre-stamp their tenant claim.',
)
async def framer_invite(
    payload: FramerInviteRequest,
    _admin: AuthPrincipal = Depends(require_admin),
) -> FramerInviteResponse:
    """Send a Supabase Auth invite with the brand_id baked into app_metadata.

    Two-step flow (defense in depth — the auth.users trigger from
    migration 0006 would also link, but we don't rely on that here):

      1. ``POST /auth/v1/admin/invite`` with ``data.app_metadata.brand_id``.
         Supabase creates the auth.users row, sends the invite email
         (or returns an action_link if SMTP is unset).
      2. ``POST /rest/v1/brand_members`` to materialize the membership
         row immediately, so the user has access on first sign-in.
    """
    client = supabase_admin_client()

    # 1. Resolve brand_code -> brand_id.
    brand_response = await client.get(
        '/rest/v1/brands',
        params={'select': 'id', 'slug': f'eq.{payload.brand_code}', 'limit': '1'},
    )
    if brand_response.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, 'Failed to resolve brand_code.')
    brand_rows = brand_response.json() or []
    if not brand_rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f'Brand {payload.brand_code!r} not found.')
    brand_id = str(brand_rows[0]['id'])

    # 2. Invite via Supabase Auth admin API. ``data`` populates
    # auth.users.raw_user_meta_data — the 0006 trigger reads brand_code
    # from there as a backup path. We do NOT rely on
    # /admin/invite to set app_metadata: that field is not accepted by
    # every Supabase release. Instead we PATCH it in step 3.
    invite_response = await client.post(
        '/auth/v1/admin/invite',
        json={
            'email': payload.email,
            'data': {'brand_code': payload.brand_code},
        },
    )
    if invite_response.status_code >= 400:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f'Supabase invite failed: {invite_response.text[:200]}',
        )
    invite_payload = invite_response.json()
    invited_user_id = str(invite_payload.get('id') or invite_payload.get('user', {}).get('id') or '')
    if not invited_user_id:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            'Supabase invite returned no user id.',
        )
    action_link = invite_payload.get('action_link')

    # 3. Stamp app_metadata.brand_id authoritatively. raw_app_meta_data
    # is service-role-only, so this PUT is the only way for tenant-api
    # to write it. After this call the user's first JWT carries the
    # tenant claim — no need to wait for the 0006 trigger to fire on
    # email confirmation.
    stamp_response = await client.put(
        f'/auth/v1/admin/users/{invited_user_id}',
        json={'app_metadata': {'brand_id': brand_id}},
    )
    if stamp_response.status_code >= 400:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            'Invite issued but failed to stamp brand_id; contact support.',
        )

    # 4. Membership row. ``ignore-duplicates`` keeps a re-invite idempotent.
    member_response = await client.post(
        '/rest/v1/brand_members',
        json={'brand_id': brand_id, 'user_id': invited_user_id, 'role': payload.role},
        headers={'Prefer': 'resolution=ignore-duplicates,return=minimal'},
    )
    if member_response.status_code >= 400:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            'Invite issued but membership write failed; contact support.',
        )

    return FramerInviteResponse(
        user_id=invited_user_id,
        email=payload.email,
        brand_id=brand_id,
        invite_url=action_link,
    )
