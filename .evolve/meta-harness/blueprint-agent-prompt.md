# Blueprint-Agent Prompt — Does starter-foundry actually help the agent?

Paste the block below into a blueprint-agent session. It's self-contained.

---

## Brief

Starter-foundry just shipped meta-harness Gen 1 (starter-foundry PR #4). The
shipped numbers:

- Latency p95: 0.902 → 0.477 ms (-47%)
- Ideasai capability-hit rate: 0.181 → 0.452 (+27 pp)
- Zero accuracy regression on 363 eval scenarios

But those are **proxy metrics against a hand-authored expected list**. They
don't answer the product question: *does running starter-foundry before the
agent make the agent ship faster, cheaper, or more reliably than not running
it?* Until we answer that, we can't tell whether Gen 1 was a real win or just
a benchmark tune.

Your job: extend the existing benchmark infra in
`scripts/experiments/` so we can A/B the scaffolded vs no-scaffold path on
real free-text prompts, with real sidecar agents, and produce a number we'd
actually report to the team.

## What already exists — read first, extend, don't replace

1. `scripts/experiments/run-benchmark.ts` — CLI entry, spawns infra (Docker +
   orchestrator + web), runs scenarios end-to-end, writes per-run JSON to
   `scripts/experiments/results/`.
2. `scripts/experiments/scenarios/free-text-scenarios.ts` — free-text prompt
   scenarios (this is the surface area that exercises the starter-foundry
   compose-prompt path).
3. `scripts/experiments/lib/agentic-user.ts`, `lib/agentic-suite.ts` — the
   agentic-user runner that drives the full chat loop and captures
   trajectories.
4. `scripts/experiments/lib/benchmark-runner.ts` — timing + lifecycle +
   persistence of runs.
5. `scripts/experiments/run-cost-quality-matrix.ts` — already sweeps cost ×
   quality across runs; models the shape of output we want.
6. `.trajectories/traj_*.json` — prior agent execution transcripts.
7. `.evolve/meta-harness/` in this repo — blueprint-agent already has its own
   meta-harness (prompt-evolution oriented, per `config.json`). Don't collide
   with it; add a sibling **scaffold-value** harness or a new scenario axis.
8. `apps/web/src/lib/.server/scaffolds/index.ts` — where
   `getComposeCommand(prompt)` builds the CLI call that invokes starter-foundry
   inside the container.

## Deliverable

A CLI runnable via `pnpm tsx scripts/experiments/run-scaffold-ab.ts` (or an
equivalent flag on `run-benchmark.ts`) that, for each prompt in a scenario
list:

1. Runs the agentic-user once with starter-foundry (the current production
   path — `getComposeCommand` fires, scaffold lands in /home/agent).
2. Runs the agentic-user once with starter-foundry *disabled* (the null
   scaffold — empty /home/agent, same context message otherwise).
3. Captures for each run:
   - `turns_to_preview` — message count from user's first prompt to the
     dev-server URL rendering the feature they asked for. Use the existing
     dev-server-readiness detection in `agentic-user.ts`.
   - `turns_to_completion` — message count until the agent signals "done" or
     the scenario's success criterion triggers.
   - `tool_calls_total`, `edit_count`, `file_creates` — from the trajectory.
   - `wall_time_ms` — end-to-end.
   - `tokens_input`, `tokens_output` — sum over the run from the provider
     response metadata.
   - `failed_tool_calls` — any tool call that errored or had to be retried.
   - `user_intent_preserved` — heuristic LLM-judge: given the prompt and the
     final file tree, does the scaffold match what the user asked for? Use the
     same judge pattern `run-cost-quality-matrix.ts` uses so we don't invent
     a second one.
4. Writes paired JSONL to `scripts/experiments/results/scaffold-ab/<run-id>/`.

Then an aggregator CLI that reads a run dir and prints:

- Win rate: for how many prompts did the scaffolded run reach preview
  sooner? Completion sooner? Use fewer tool calls? Use fewer tokens?
- Mean deltas with 95% CI (bootstrap, n=1000).
- Per-archetype slice (AI SaaS vs contract-only vs agent-service vs pure
  frontend) so we can see where scaffolding helps vs hurts.

## Scenario list

Start with 20 prompts, not 200. Split evenly:

- 5 from the ideasai corpus (AI SaaS products — where Gen 1 was supposed to
  help most)
- 5 from the vibecoder corpus (Bolt/v0-style consumer apps)
- 5 partner-specific (from `partner-templates.ts`, e.g. Coinbase, Tangle,
  Arbitrum) — the curated-tarball path is the control for the free-text path
- 5 adversarial edge cases: vague prompts ("build me a website"), mixed
  signals ("React AI agent dashboard"), and null-hypothesis prompts where
  scaffolding shouldn't matter

Corpora live in the starter-foundry package at
`node_modules/@tangle-network/starter-foundry/corpus/`. Reuse don't copy.

## Success = we can answer these

1. Mean Δturns_to_preview (scaffolded − no-scaffold) with CI, per archetype.
2. Mean Δtokens_input with CI (scaffolding adds ~context; does that pay off?).
3. Rate of user_intent_preserved=yes, scaffolded vs not.
4. Which archetypes regress with scaffolding (if any)? Named list.
5. Gen 1's new capability inference added `layout-dashboard` / `ai-chat-ui`
   to AI SaaS prompts. Did the agent actually USE those files, or edit them
   heavily, or ignore them? Count edits-per-scaffolded-file from the
   trajectory.

## Constraints

- **No mocks.** Real sidecar agents. Real starter-foundry CLI. Real dev server
  readiness. Mocks here defeat the entire point.
- **Reuse, don't duplicate.** The scaffold-ab runner extends
  `BenchmarkRunner` and `AgenticUserRunner`; it doesn't re-implement them. If
  you find yourself writing a second chat loop, stop and reuse.
- **Determinism where possible.** Seed the agentic-user's model with a fixed
  temperature and a fixed seed if the provider exposes one. Log the model id
  + seed in the result JSON.
- **One prompt, one sidecar lifetime.** Don't reuse sidecars across runs —
  container state leaks.
- **Budget awareness.** 20 prompts × 2 arms × 1 provider = 40 agentic runs.
  At ~$0.50/run that's $20. Before scaling to 200 prompts we look at
  Gen 1's signal first.

## Anti-goals

- Don't invent a new eval format. Match the existing agentic-summary JSON
  shape in `scripts/experiments/results/`.
- Don't build a UI. CLI + JSON + stdout summary is enough for now.
- Don't optimize starter-foundry based on what you find — just report. The
  optimization loop lives in the starter-foundry repo, not here.

## Output format

When you're done, return:

1. The path to the new runner.
2. The shape of the output JSON (one-line schema).
3. Command to reproduce a 4-prompt smoke run (so someone can verify it works
   before committing to the 20-prompt scale run).
4. A single paragraph: *the honest list of what this eval will and won't be
   able to tell us.* Include what we'll have to decide based on intuition
   because the eval can't isolate it.
