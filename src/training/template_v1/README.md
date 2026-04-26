# template_v1 — agentic template-quality loop

## Flow

```
.evolve/template-rewrites/<tmpl>.jsonl  (mined by scripts/mine-template-rewrites.mjs)
    │
    ▼
harvest.ts        — group tuples by (family, template), extract common patterns
    │             — signal: which lines agents ALWAYS remove, ALWAYS add, ALWAYS change
    ▼
synthesize.ts     — AxLLM call: given (current template, rewrite tuples, scaffold context),
    │               produce a candidate template that incorporates the common edits
    │               while keeping placeholders that agents productively replace
    ▼
judge.ts          — AxLLM call: current vs candidate, score for
    │               (1) fewer unnecessary rewrites (2) same or better audit-pass
    │               (3) preserves placeholders the agent SHOULD replace
    ▼
audit.ts          — compose a scaffold with the candidate, run audit-scaffold-quality.mjs,
    │               reject if install or typecheck regresses
    ▼
promote.ts        — emit a PR to the registry with (a) the new template,
                    (b) a before/after summary of rewrite counts, (c) the judge's
                    reasoning, (d) the audit output proving no regression
```

## Status

- `scripts/mine-template-rewrites.mjs` — DONE. Mines 253 tuples across 7 templates
  from the current corpus (as of 2026-04-20).
- `harvest.ts` / `synthesize.ts` / `judge.ts` / `audit.ts` / `promote.ts` — TODO,
  next session. Each is ~100 LOC atop the existing `src/training/variant_b/`
  AxFlow infrastructure.

## Why this matters

This is the S+ moat. Every other repo with scaffolds requires humans to
hand-craft templates. We're building a pipeline that generates better
templates from observed agent behavior — so the repo's template quality
improves with every buildout, without human editing.

## Running (once implemented)

```bash
pnpm build
node scripts/mine-template-rewrites.mjs  # refresh tuples
pnpm tsx src/training/template_v1/run.ts --template src/App.tsx --family react-vite-ts --dry-run
#                                          ↑ can target any of the 7 mined templates
```

Dry-run: prints the candidate + judge scoring. Without `--dry-run`: opens a
PR with the candidate.

## Evidence contract

Every promote step MUST attach:

- Before/after rewrite counts for the targeted template (from the next buildout sweep)
- Before/after audit status (install + typecheck) for the affected family
- Judge's reasoning trace

No promote without evidence. The loop is only useful if every claim is
measurable.
