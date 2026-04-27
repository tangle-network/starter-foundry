# agent-research-harness-py

Python sibling of `agent-research-harness-ts`. Operator-facing research
loop:

```
python -m research propose      # LLM-driven hypothesis variant generation
python -m research screen       # 1 rep per hypothesis, rank by mean delta
python -m research validate     # 5 reps on winners, bootstrap CI + Cohen's d
python -m research sweep        # propose -> screen -> validate
```

Each hypothesis runs inside an isolated `tangle-sandbox`. The harness
never mutates the host. Statistical math (`scipy.stats`) mirrors the
TS sibling family byte-for-byte so verdicts are stable across
languages.

> **`tangle-sandbox` PyPI status (2026-04-27): not yet published.** The
> SDK source is at `~/webb/agent-dev-container/products/sandbox/sdk-python/`
> (version 0.1.0). Until publish lands, install from local checkout:
>
> ```bash
> pip install -e ~/webb/agent-dev-container/products/sandbox/sdk-python/
> ```

## Layout

```
src/research/
  runner.py        main loop
  proposer.py      LLM-driven hypothesis variant generator
  screener.py      cheap-pass screener (1 rep)
  validator.py     winners-only multi-rep + bootstrap CI + Cohen's d
  sandbox_runner.py  tangle-sandbox lifecycle wrapper
  cli.py           argparse entrypoint
  __main__.py      python -m research dispatcher

hypotheses/
  queue.json       active queue (read by screen/validate)
  example.json     canonical example
  README.md        schema docs (portable across py/ts)

tests/
  test_screener.py
  test_validator.py
  test_sandbox.py
```

## Environment

Required:

- `TANGLE_ROUTER_KEY` — for the proposer's LLM calls (router.tangle.tools)
- `TANGLE_SANDBOX_KEY` — for tangle-sandbox client

## Quality contract

- Every result records: hypothesis hash, sandbox image, scipy version,
  harness version, RNG seed.
- No silent fallbacks. Sandbox unreachable => raise. Validation errors
  => raise.
- Bootstrap CI: 95%, 1000 resamples, fixed seed.
- Cohen's d: pooled-variance form.
