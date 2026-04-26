# agent-common

Shared Python package consumed by every agent backend in `agents/*`.
Eliminates the ~350 LOC of copy-paste that previously lived in
`agents/<name>/backend/app/services/` (4 near-identical copies of
`http_client.py`, `openrouter.py`, `prompt_loader.py`, plus 2 copies of
`replicate.py` and `sanitize.py`) and the per-agent `external/security.py`
module that all four agents had verbatim.

## What's in here

| Module | Replaces |
|---|---|
| `agent_common.http_client` | 4× `app/services/http_client.py` |
| `agent_common.openrouter` | 4× `app/services/openrouter.py` (parametrized: model env-var name + fallback env-var name + service title) |
| `agent_common.replicate` | 2× `app/services/replicate.py` (parametrized: model, inputs, max polls, output extractor) |
| `agent_common.prompt_loader` | 4× `app/services/prompt_loader.py` |
| `agent_common.sanitize` | 2× `app/services/sanitize.py` (parametrized: prompt-leak markers per agent) |
| `agent_common.security` | 4× `app/external/security.py` (token-bucket, X-API-Key, security-headers middleware) |
| `agent_common.external_config` | 4× `app/external/config.py` (parametrized: env-var key for the API-key list) |

## Install

Each agent's Dockerfile installs this in editable mode:

```dockerfile
COPY packages/agent-common /tmp/agent-common
RUN pip install --no-cache-dir -e /tmp/agent-common
```

Local dev:

```bash
cd packages/agent-common && pip install -e .
```

## Usage example

```python
from agent_common.openrouter import openrouter_chat

reply = openrouter_chat(
    [{"role": "user", "content": "Hello"}],
    model_env="IMAGE_PROMPT_LLM_MODEL",
    service_title="Helio Image Generator",
)
```
