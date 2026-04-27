# Hypothesis schema

The same JSON shape is consumed by both `agent-research-harness-py`
and `agent-research-harness-ts`. Keep them in sync.

## Required fields

| field         | type                       | rules                                      |
| ------------- | -------------------------- | ------------------------------------------ |
| `id`          | string                     | kebab-case, unique across the queue        |
| `description` | string                     | >= 20 chars                                |
| `sandboxImage`| string                     | tangle-sandbox image (default `ubuntu`)    |
| `treatment`   | `{description, files, env}`| files = `{path: content}`                  |
| `baseline`    | `{description, files, env}`| same shape as treatment                    |
| `scenarios`   | array (>= 1)               | each: `{id, description, command[], direction?}` |
| `metrics`     | array of unique strings    | numeric fields the harness will extract    |
| `tags`        | array of strings           | optional, free-form                        |

## Scenario `command`

`command` is an argv array. The harness joins it with spaces and
runs it inside the sandbox via `box.exec(...)`. The command must
print a single JSON line as its **last** stdout line — that line is
parsed for `metrics[]`.

Example last-line:

```json
{"throughput_qps": 1234, "p95_ms": 12.4}
```

## Direction

- `higher-is-better` (default) — the screener / validator interpret a
  positive `treatment - baseline` delta as desirable.
- `lower-is-better` — applies to latency, error-rate, cost. The
  hypothesis writer must invert the metric upstream (multiply by -1)
  if they want the same verdict ladder. The harness deliberately
  doesn't auto-invert — explicit > clever.

## Worked example

See `example.json`. Drop new hypotheses into `queue.json` (a top-level
JSON array). The CLI's `propose` subcommand will append generated
variants for you.
