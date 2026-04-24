# Evolve Progress — starter-foundry

Thin index. Detail lives in:
- `git log --oneline` for commits
- `.evolve/reflections/*.md` for arc-level analysis
- `.evolve/patterns/*.md` for named anti-patterns (load-bearing)
- `~/.claude/projects/.../memory/*.md` for durable operator-facing lessons

Each entry: date — arc — outcome — pointer.

## 2026-04-24 (evening) — R1 → R2 → R3 → C arc (4 PRs post-Gen-9)

- **R1** forge-lint `[lint]` config on forge-foundation + tangle-blueprint → dex-swap cluster (PR #56). Projected +6.6pp on `buildout_pass_rate`.
- **R2** `proposal_promotion_rate` 0.034 → **0.75 (MEASURED, +71pp)**. Test-fixture pollution + event-level double-counting fixes (PR #59).
- **R3** efficiency cluster — `AGENTS.md` lists pre-installed packages, forbids `pnpm add` on already-present deps (PR #60). Projected.
- **C** cost-tracker wiring — two silent-fails (`.getSummary?.()` typo + never-recorded) (PR #61). Projected.

3 of 4 projected; next VB sweep measures real effects. Tests: 750/750. See reflections from this date in `.evolve/reflections/`.

## 2026-04-24 (early) — Gen 9 muffled-gate audit + R0 runtime-path closure (PR #54 + #58)

Structural audit + invariant scanner (10+ live instances closed). R0 caught the runtime-path miss Gen 9 itself had (Phase 1.5 didn't walk entry scripts). H4 split SCAN_FILES + auto-derived agent-eval-importer scan via `/research`.

See `.evolve/patterns/muffled-gate.md` and `research/decisions/001-muffled-gate-scanner-split.md`.

## 2026-04-23 — Gen 6 + Gen 7 arc (closed-loop generation flywheel)

5 families + 2 capabilities auto-promoted. Aggregate 0.407 → 0.603 (+19.6pp). Partner-first workspace routing via `/multi-pursue`.

See reflection `.evolve/reflections/2026-04-23-164043-gen6-gen7-arc.md`.

## 2026-04-22 — Measurement integrity (Gen 2 + Gen 3) + surgical-fix sweep

Staleness gate, self-healing scorecard, scaffold_audit_pass_rate 0.851 → 0.9787. Pre-push hook + nightly measurement workflow.

Reflection: `.evolve/reflections/2026-04-22-164159.md`.

## Prior arcs (one-line index)

| Date | Arc | Reflection |
|---|---|---|
| 2026-04-22 | Unified billing session (4 repos, 18 PRs) | `.evolve/reflections/2026-04-22-121604.md` |
| 2026-04-21 | Session burst — bootstrap routing + Gen 3-5 | `.evolve/reflections/2026-04-21-session-burst.md` |
| 2026-04-20 | Self-healing measurement shift | `.evolve/reflections/2026-04-20-self-healing-shift.md` |
| 2026-04-17 | Meta-harness Gen 1 | `.evolve/reflections/2026-04-17-123004.md` |
| 2026-04-02 | Initial evolve bootstrap | `.evolve/reflections/2026-04-02.md` |

For anything older, `git log --oneline --first-parent main` is authoritative.
