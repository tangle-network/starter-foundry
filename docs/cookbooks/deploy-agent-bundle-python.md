# Deploy an agent bundle from Python

Python sibling of [`deploy-agent-bundle.md`](./deploy-agent-bundle.md). Same
bundle format, same harness contract, same workspace layout — just driven by
the Python `tangle-sandbox` SDK instead of the TS one. Use this when your
target consumer is FastAPI, Streamlit, dspy, a notebook, or any of the
existing `python-*` family of starters.

## What you get

- `starter_foundry.agent_bundle` — `load_agent_bundle()`, `to_agent_profile()`,
  `to_workspace_files()`. Schema-validates against
  `registry/_schemas/agent.schema.json`, identical to the TS port.
- `starter_foundry.deploy` — `python -m starter_foundry.deploy …` CLI. Same
  flags as the TS `pnpm deploy-agent`.
- 1:1 wire-format parity with the TS port: a `--dry-run` of the same fixture
  produces the same `AgentProfile` JSON in both languages. The Python tests
  guard the boundary, and the cross-language byte-equivalence check is in the
  PR description.

## Install

```bash
cd scripts/python
# Local-first (uses the in-tree sdk-python checkout via [tool.uv.sources])
pip install -e .
# Or pin to PyPI once tangle-sandbox is published:
#   pip install starter-foundry-deploy tangle-sandbox jsonschema
```

`tangle-sandbox` only needs to be installed for live deploys —
`--dry-run` works without it (clean GAP if missing).

## Configure

Same env vars as the TS path — they're scoped to the sandbox API, not the
router. See `docs/issues/cross-product-auth-issue.md` for the SRE-side
sk-tan-\* scope work; until that lands, use a sandbox-scoped key directly:

```bash
export TANGLE_SANDBOX_API_KEY=sk_sandbox_…
export TANGLE_SANDBOX_BASE_URL=https://sandbox.tangle.tools
```

## Single-agent example

Same fixture as the TS cookbook:

```bash
python -m starter_foundry.deploy \
  --bundle registry/families/agent-runtime-research \
  --name research-assistant-py \
  --task "Summarise the literature on tool-use evaluation."
```

Produces:

- one sandbox named `research-assistant-py` with `backend.profile` set to
  the inlined `AgentProfile` (system prompt, model defaults, tools,
  permissions, methodology files as inline mounts)
- `/home/agent/AGENTS.md` written via `box.files.write`
- `/home/agent/methodology/literature-survey.md` and
  `/home/agent/methodology/proposal-drafting.md` written via `box.files.write`
- the agent's response to the task, with token usage + duration

`--dry-run` prints the AgentProfile + the workspace-file plan without
contacting the SDK.

## Multi-agent example

```bash
python -m starter_foundry.deploy \
  --bundle registry/families/multi-agent-startup-team-ts \
  --name multi-agent-py \
  --task "Have the team draft a one-page launch plan."
```

Produces, additionally, `/home/agent/agents.json` with the OpenCode subagent
shape — same shape the TS port writes, contract verified in PR #102. The
Python `agents.json` test asserts singular `permission` (not bundle-side
plural `permissions`) and inline prompt content.

## Programmatic use

```python
from pathlib import Path
from starter_foundry.agent_bundle import (
    load_agent_bundle,
    to_agent_profile,
    to_workspace_files,
)

bundle_dir = Path("registry/families/agent-runtime-research")
bundle = load_agent_bundle(bundle_dir)
profile = to_agent_profile(bundle, bundle_dir)
files = to_workspace_files(bundle, bundle_dir)

# Pass `profile` as backend.profile to tangle_sandbox.Sandbox.create(),
# then iterate `files` and call `box.files.write(f.targetPath, f.content)`.
```

## SDK divergence audit

The Python and TS SDKs agree on the wire format we depend on:

- `client.create({ name, image, backend: { profile } })` ←→
  `Sandbox.create(CreateSandboxOptions(name=…, image=…, backend=BackendConfig(profile=…)))`
  — both serialise `profile` as a JSON object on the create-sandbox request.
- `box.files.write(path, content)` ←→ `box.files.write(path, content)` — same
  HTTP endpoint shape (`POST /files/write` with `{ path, content }`).
- `box.task(prompt)` ←→ `box.task(prompt)` — both return a result with
  `success`/`response`/`error`/`usage`/`duration_ms`.

No adapter code needed; the `AgentProfile` dict the Python port builds drops
straight into `BackendConfig.profile` as `dict[str, Any]`. If the wire
contract drifts, the TS-vs-Python `--dry-run` parity check in CI surfaces it
immediately.

## GAP — live deploy proof

Same gate as the TS cookbook (see
[`gen12-live-proof.md`](./gen12-live-proof.md)): live end-to-end deploys are
gated on the staging/prod sandbox provisioner being healthy, which is an
SRE-side blocker independent of this port. `--dry-run` parity is proven; live
parity ships when the provisioner does.
