# starter-foundry — Python sibling

1:1 port of the TS `agent-bundle` loader + `deploy-agent-bundle` CLI driven by
the Python `tangle-sandbox` SDK instead of the TS one. See
[`docs/cookbooks/deploy-agent-bundle-python.md`](../../docs/cookbooks/deploy-agent-bundle-python.md)
for the full cookbook.

## Layout

```
scripts/python/
  pyproject.toml
  starter_foundry/
    __init__.py         # public surface re-exports
    agent_bundle.py     # 1:1 port of src/lib/agent-bundle.ts
    deploy.py           # CLI (python -m starter_foundry.deploy …)
  tests/
    test_agent_bundle.py
    conftest.py         # resolves repo-root + tests/fixtures/
```

The Python tests reuse the canonical fixtures at `<repo>/tests/fixtures/`
(via `conftest.py`) — no duplication.

## Install + test

```bash
cd scripts/python
pip install -e '.[dev]'
pytest -v
```

## CLI

```bash
python -m starter_foundry.deploy --bundle <path> --name <sandbox-name> [--dry-run]
```

Wire-format parity with the TS port — `--dry-run` produces the same
`AgentProfile` JSON either way. Live deploys gated on the SRE-side
provisioner; see the cookbook for the GAP.
