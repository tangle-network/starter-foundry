"""validate_plan_via_cli — dry-run a ComposeSpec by shelling to the CLI.

Shell bridge is the simple transport today; a future phase exposes an
HTTP endpoint for consumers who don't have node in their container.
"""

import json
import subprocess
from typing import Any


def validate_plan_via_cli(spec: dict[str, Any], cwd: str | None = None) -> dict[str, Any]:
    """Validate a ComposeSpec against the live registry.

    Returns {"ok": bool, "issues": [{"path": str, "message": str}]}.

    Requires node + the starter-foundry package on the machine. Raises
    RuntimeError if the CLI is unavailable.
    """
    snippet = """
      const fs = require('node:fs');
      const spec = JSON.parse(process.env.SPEC);
      (async () => {
        const { validatePlan } = await import('@tangle-network/starter-foundry');
        const result = await validatePlan(spec);
        process.stdout.write(JSON.stringify(result));
      })().catch((e) => { process.stderr.write(String(e)); process.exit(1); });
    """.strip()
    try:
        out = subprocess.run(
            ["node", "--input-type=module", "-e", snippet],
            env={"SPEC": json.dumps(spec), "PATH": "/usr/bin:/bin:/usr/local/bin"},
            cwd=cwd,
            capture_output=True,
            text=True,
            check=True,
            timeout=20,
        )
    except FileNotFoundError:
        raise RuntimeError("node binary not found — validate_plan_via_cli requires node on PATH")
    except subprocess.CalledProcessError as err:
        raise RuntimeError(f"validatePlan bridge failed: {err.stderr}")
    return json.loads(out.stdout)
