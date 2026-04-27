# agent-eval-harness-py

Python eval harness for agent-under-test scoring. Loads scenarios, runs them
against an agent (local fn / HTTP endpoint / tangle-sandbox), scores with
multi-dim LLM judges via `router.tangle.tools`, emits a `scorecard.json`
that is byte-for-byte compatible with the TS sibling
([`agent-eval-harness-ts`](../agent-eval-harness-ts)) so cross-language
`compare` works.

## Quick start

```bash
pip install -e ".[dev]"
python -m eval run --scenarios scenarios --out scorecard.json
```

> **`tangle-sandbox` PyPI status (2026-04-27): not yet published.** The
> SDK source is at `~/webb/agent-dev-container/products/sandbox/sdk-python/`
> (version 0.1.0). Until `pip install tangle-sandbox` is publishable,
> install from local checkout:
>
> ```bash
> pip install -e ~/webb/agent-dev-container/products/sandbox/sdk-python/
> ```
>
> The `--driver sandbox` mode requires this; `--driver local` and
> `--driver http` work without it.

The default scenario (`scenarios/example.py`) runs offline with a local
agent + offline judge — useful for smoke tests.

To run with the LLM-judge:

```bash
export TANGLE_ROUTER_KEY=sk-tan-...
python -m eval run --scenarios scenarios --out scorecard.json
```

To run against a tangle-sandbox-deployed agent bundle:

```bash
export TANGLE_SANDBOX_API_KEY=sk-...
export TANGLE_SANDBOX_BASE_URL=https://sandbox.tangle.tools
python -m eval run \
  --scenarios scenarios \
  --bundle path/to/agent-bundle \
  --driver sandbox \
  --out scorecard.json
```

## Regression gate

```bash
python -m eval compare baseline.json head.json
# Welch's t-test, alpha=0.05; Cohen's d threshold 0.2; 1000-resample bootstrap CI
```

For a meaningful gate you need ≥8 repeated samples per flow (we won't
fabricate a CI from a single value). Provide them with `--samples
samples.json` where `samples.json` looks like:

```json
{
  "<flow-name>": {
    "baseline": [0.83, 0.85, 0.84, 0.86, 0.85, 0.87, 0.85, 0.84],
    "head":     [0.81, 0.79, 0.82, 0.80, 0.83, 0.81, 0.78, 0.80]
  }
}
```

## Scenario contract

```python
# scenarios/<name>.py
from eval.judges.rubric import RubricJudge, RubricDimension

JUDGE = RubricJudge(
    name="quality",
    dimensions=[
        RubricDimension(name="correctness", description="...", weight=2.0),
        RubricDimension(name="completeness", description="...", weight=1.0),
    ],
)

def _agent(prompt: str) -> str:  # only required for --driver local
    ...

SCENARIO = {
    "name": "unique-flow-name",
    "input": "the prompt sent to the agent",
    "expected_output": "reference (optional)",
    "target": 0.85,
    "direction": "higher-better",        # or "lower-better"
    "productValueClaim": "one sentence — what does pass mean to the user",
    "agent_fn": _agent,
    "judges": [JUDGE],
}
```

## Layout

```
src/eval/
  __init__.py            public surface
  __main__.py            python -m eval
  cli.py                 argparse: run | compare
  runner.py              scenario loader + dispatcher
  scorecard.py           Pydantic models + cross-language JSON
  sandbox_runner.py      tangle-sandbox lifecycle
  regression.py          bootstrap CI / Cohen's d / Welch's t-test
  judges/
    __init__.py
    rubric.py            LLM-as-judge over router.tangle.tools
    example_judge.py     3-dim code-quality rubric
scenarios/
  example.py             smoke (offline agent + offline judge)
tests/
  test_runner.py         scenario loader + flow emission
  test_regression.py     gate math (anchors)
  test_sandbox.py        SandboxDriver lifecycle (mocked SDK)
.github/workflows/eval.yml  CI: pytest + example run + regression gate
```

## Cross-language compatibility

This harness emits the same `scorecard.json` shape as
`agent-eval-harness-ts`. A baseline produced by either harness can be
compared against a head from the other:

```bash
python -m eval compare ts-baseline.json py-head.json
# or
node ts/dist/cli.js compare py-baseline.json ts-head.json
```

Field rounding (4 decimals on `value` / `target` / `aggregate`), key
order, and the Welch + Cohen + bootstrap CI math are all aligned.

## What this is NOT

- A general-purpose benchmark suite — write your own scenarios.
- A judge marketplace — `RubricJudge` is one implementation; build domain
  judges in `src/eval/judges/`.
- A safe substitute for human review — judges are noisy. The regression
  gate exists because LLM-judge variance is non-trivial.
