"""One-time migration: env-var ``HELIO_EXTERNAL_API_KEYS_*`` -> ``brand_api_keys``.

Reads the legacy environment variables, hashes each secret with SHA-256,
and inserts the rows into ``brand_api_keys`` under a single
``default-tenant`` brand. After the migration the operator removes the
``HELIO_EXTERNAL_API_KEYS_*`` env vars; agents pick up the new flow on
next deploy.

Usage::

    SUPABASE_URL=https://<project>.supabase.co \\
    SUPABASE_SERVICE_ROLE_KEY=eyJ... \\
    HELIO_EXTERNAL_API_KEYS_IMAGE='helio_live_xxx,framer:helio_live_yyy' \\
    HELIO_EXTERNAL_API_KEYS_VIDEO='helio_live_zzz' \\
    HELIO_EXTERNAL_API_KEYS_STORYTELLER='' \\
    HELIO_EXTERNAL_API_KEYS_CAMPAIGN='' \\
    DEFAULT_BRAND_OWNER_USER_ID=<uuid> \\
        python services/tenant-api/scripts/migrate_env_keys.py

Idempotent: re-running with the same secrets is a no-op (key_hash is
unique). Existing rows are not touched.
"""

from __future__ import annotations

import hashlib
import os
import sys
from typing import Iterable

import httpx

DEFAULT_BRAND_SLUG = "default-tenant"


def _split(raw: str | None) -> list[tuple[str, str]]:
    """Parse ``label:secret,bare_secret,...`` into a list of (label, secret)."""
    pairs: list[tuple[str, str]] = []
    if not raw:
        return pairs
    for index, item in enumerate(raw.split(",")):
        item = item.strip()
        if not item:
            continue
        if ":" in item:
            label, secret = item.split(":", 1)
            label = label.strip() or f"key-{index + 1}"
            secret = secret.strip()
        else:
            label, secret = f"key-{index + 1}", item
        if secret:
            pairs.append((label, secret))
    return pairs


def _ensure_default_brand(client: httpx.Client, owner_user_id: str) -> str:
    """Idempotently create the ``default-tenant`` brand. Returns its id."""
    response = client.get(
        "/rest/v1/brands",
        params={"select": "id", "slug": f"eq.{DEFAULT_BRAND_SLUG}", "limit": "1"},
    )
    response.raise_for_status()
    rows = response.json()
    if rows:
        return str(rows[0]["id"])

    response = client.post(
        "/rest/v1/brands",
        json={
            "slug": DEFAULT_BRAND_SLUG,
            "display_name": "Default tenant (legacy keys)",
            "owner_user_id": owner_user_id,
        },
    )
    response.raise_for_status()
    brand = response.json()[0] if isinstance(response.json(), list) else response.json()
    brand_id = str(brand["id"])

    # Owner membership in the same operation.
    member_response = client.post(
        "/rest/v1/brand_members",
        json={"brand_id": brand_id, "user_id": owner_user_id, "role": "owner"},
    )
    member_response.raise_for_status()
    return brand_id


def _ensure_default_agent_rows(client: httpx.Client, brand_id: str) -> None:
    """Pre-populate brand_agents (enabled+published) and brand_quotas (unlimited)."""
    for agent_kind in ("image", "video", "storyteller", "campaign", "soul-print"):
        # brand_agents — enabled + published so legacy keys don't 403.
        client.post(
            "/rest/v1/brand_agents",
            json={
                "brand_id": brand_id,
                "agent_kind": agent_kind,
                "enabled": True,
                "published_at": "now()",
            },
            headers={"Prefer": "resolution=ignore-duplicates,return=minimal"},
        )
        client.post(
            "/rest/v1/brand_quotas",
            json={
                "brand_id": brand_id,
                "agent_kind": agent_kind,
                "monthly_budget_cents": 0,  # unlimited
            },
            headers={"Prefer": "resolution=ignore-duplicates,return=minimal"},
        )


def _migrate_keys(
    client: httpx.Client,
    brand_id: str,
    pairs_by_agent: dict[str, list[tuple[str, str]]],
) -> tuple[int, int]:
    inserted = 0
    skipped = 0
    for agent, pairs in pairs_by_agent.items():
        for label, secret in pairs:
            key_hash = hashlib.sha256(secret.encode("utf-8")).digest()
            response = client.post(
                "/rest/v1/brand_api_keys",
                json={
                    "brand_id": brand_id,
                    "label": f"legacy:{agent}:{label}",
                    "key_hash": "\\x" + key_hash.hex(),
                    "prefix": secret[:8],
                },
            )
            if response.status_code == 409:
                skipped += 1
                continue
            if response.status_code >= 400:
                print(
                    f"[migrate] FAILED on {agent}:{label}: {response.status_code} {response.text[:200]}",
                    file=sys.stderr,
                )
                continue
            inserted += 1
            print(f"[migrate] inserted: agent={agent} label={label} prefix={secret[:8]}")
    return inserted, skipped


def main() -> int:
    supabase_url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    service_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    owner_user_id = (os.getenv("DEFAULT_BRAND_OWNER_USER_ID") or "").strip()
    if not supabase_url or not service_key or not owner_user_id:
        print(
            "ERROR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and "
            "DEFAULT_BRAND_OWNER_USER_ID must be set.",
            file=sys.stderr,
        )
        return 2

    pairs_by_agent = {
        "image":       _split(os.getenv("HELIO_EXTERNAL_API_KEYS_IMAGE")),
        "video":       _split(os.getenv("HELIO_EXTERNAL_API_KEYS_VIDEO")),
        "storyteller": _split(os.getenv("HELIO_EXTERNAL_API_KEYS_STORYTELLER")),
        "campaign":    _split(os.getenv("HELIO_EXTERNAL_API_KEYS_CAMPAIGN")),
    }
    total = sum(len(v) for v in pairs_by_agent.values())
    print(f"[migrate] {total} legacy key(s) found across {len(pairs_by_agent)} agent(s).")

    with httpx.Client(
        base_url=supabase_url,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        timeout=httpx.Timeout(30.0),
    ) as client:
        brand_id = _ensure_default_brand(client, owner_user_id)
        print(f"[migrate] default brand_id={brand_id}")
        _ensure_default_agent_rows(client, brand_id)
        inserted, skipped = _migrate_keys(client, brand_id, pairs_by_agent)
        print(f"[migrate] done. inserted={inserted} skipped(duplicate)={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
