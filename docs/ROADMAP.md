# ROADMAP — from 50% to 100% (scaffold standard)

**North star**: prompt → composed project in <5s, agent ships feature work on turn 1, every surface auto-improves from observed agent behavior, extensible to any domain in hours.

**Bootstrap principle**: we don't wait for real user data. Synthetic prompts from strong models (Opus / GPT / o4 / Claude) seed every loop — template quality, routing training, capability proposal, family coverage. Real data replaces synthetic as it arrives.

**Architectural principle**: every branch shares primitives. `synthetic/`, `ab/`, `safety/`, `sbom/`, `visual-regression/`, `brand/` are foundational libraries the checklists below call into. Build the library once; every checklist item is a wiring job.

---

## Branch 1 — Coverage breadth (routable worlds)

Target: +60 families, +80 capabilities, +20 partners. Every new surface bootstraps from synthetic prompts + validated end-to-end before merge.

**Shipped this session (2026-04-21) — +40 families, +10 partners via 6 parallel subagent worktrees:**

Partners:
- [x] Chain partners: `monad`, `sei-evm`, `avalanche`, `linea`, `polygon`
- [x] Stablecoin/social partners: `tether`, `usdc-circle`, `hyperliquid`, `lens`, `farcaster`

SSGs + scientific/data:
- [x] `astro-static`, `eleventy-static`, `hugo-static`, `zola-static`
- [x] `jupyter-book`, `observable-notebook`, `streamlit-advanced`

Games + GPU:
- [x] `threejs-game`, `phaser-game`, `pixijs-game`
- [x] `bevy-web`, `godot-web`, `unity-web-proxy`
- [x] `webgpu-inference`, `webgpu-render`

ML/inference serving:
- [x] `ollama-server`, `tgi-server`, `rag-pipeline-py`, `sglang-server`, `triton-server`, `skypilot-serving`, `lora-training`

Native desktop + mobile:
- [x] `tauri-menubar`, `tauri-tray`, `electron-native-os`
- [x] `expo-rn-rich` (Skia + Reanimated + Navigation stack)

A/V + modality frontends:
- [x] `livekit-sfu`, `hls-origin`, `realtime-audio-ts`
- [x] `voice-first-agent`, `vision-first-agent`, `multimodal-agent`

Chains + industry verticals:
- [x] `aptos-move`, `celestia-da`
- [x] `healthcare-hipaa-backend`, `fintech-ledger-backend`, `legal-case-mgmt`
- [x] `k12-edtech`, `crm-backend`, `ecommerce-headless`

**Still queued (specialist toolchain / hardware gates):**
- [ ] Mobile: `flutter-app` (Dart), `kotlin-multiplatform` (needs Android SDK + Gradle), `swiftui-expo` (needs Xcode)
- [ ] Embedded: `esp32-rust`, `stm32-rust`, `rp2040-embassy`, `arduino-cpp`
- [ ] Robotics: `ros2-node-py`, `ros2-node-rust`, `px4-mavsdk`

Each of the queued items needs either a specialist toolchain we can't hermetically validate in CI (iOS, Android-native) or hardware drivers (embedded, robotics). They're next-session work once we decide how to handle non-hermetic validation.

Pattern for each: `pnpm propose:family --id ... --llm` (new this session — wraps the driver) → review `.evolve/family-proposals/<id>/` → merge into registry/ → audit green → PR.

Pattern for each: `pnpm new:family` → synthetic bootstrap drafts manifest + buildHints → human verifies → audit green → PR.

## Branch 2 — Template-quality loop completion

- [x] harvest → synthesize (deterministic) → judge → audit → apply (CLI `run.ts`)
- [x] Multi-proposer synthesis (3 parallel candidates; judge picks; escalate on ties) — `src/training/template_v1/multi-propose.ts`
- [x] LLM synthesizer wired + exercised (`scripts/template-quality-sweep.mjs` — smoke-tested end-to-end with router key; produces promotable candidates scoring ≥0.7 on real top-rewritten templates)
- [x] Weekly CI sweep across top-N rewritten templates (`.github/workflows/template-quality.yml`)
- [x] Nightly auto-PR opener for promotable candidates (`scripts/open-template-prs.mjs`)
- [x] New-family synthesis loop (`scripts/propose-family.mjs` + `src/training/family_proposer/propose.ts` — reads N peer families, LLM-drafts manifest + template files, emits to `.evolve/family-proposals/<id>/`)
- [x] Judge-of-judges calibration (Branch 2.3) — `tests/judge-calibration.test.ts` + `.evolve/gold/judge-gold.jsonl`. Current ρ = 0.888 vs 8-entry hand-labeled gold (threshold 0.5). Fail-fast tests also check clear regressions score <0.5 + clear wins score >0.55.
- [x] VB pass-rate reward (Branch 2.4) — `scripts/family-pass-rate-trend.mjs` emits weekly family pass-rate trend; judge reads latest 2-week slope + blends into composite score at 5%. Weight lifts automatically as trace volume grows.
- [x] Auto-revert on rewrite-rate regression (Branch 2.6) — `scripts/template-regression-watcher.mjs` compares 7d recent rewrite counts vs prior 7d; when recent/prior > 1.2 AND a template-sweep commit is responsible, opens a revert PR. Wired into `.github/workflows/template-quality.yml`.
- [x] Cross-template dep cascade detection (Branch 2.7) — `scripts/dep-cascade-detector.mjs` finds npm deps used in ≥2 layers with inconsistent versions; writes `.evolve/proposals/dep-cascade.json` for coordinated-bump candidates. Wired into the weekly CVE sweep. (Detector ships now; auto-bump PR is follow-on — a conservative choice since unifying a dep across N layers is a judgment call.)

## Branch 3 — Measurement depth

- [x] 10 scorecard flows with productValueClaims; nightly snapshot
- [x] Visual regression primitive (`src/lib/visual-regression.ts` — SHA-256 snapshot + diff)
- [x] Per-scenario trend archive script (`scripts/archive-scorecard-trend.mjs` → `.evolve/trends/trend.jsonl`)
- [x] A/B experiment primitive (`src/lib/ab.ts` — stable-hash variant assignment)
- [ ] Visual regression GOLDEN SET captured + diff gate wired into CI
- [ ] Lint-aware rewrite delta (rewrites of lint-clean vs lint-broken code counted differently)
- [ ] Cost-per-buildout: token + LLM-call estimator per scaffold
- [ ] A/B experiments actively running (primitive exists; nothing ramped)
- [ ] Real-time telemetry stream (consumer SDK → aggregator → live dashboard)
- [ ] Quality-vs-speed Pareto chart
- [ ] Coverage heatmap: (industry × runtime × partner) grid, gaps auto-flagged

## Branch 4 — Personalization depth

- [x] `personalize.json` + `personalize.css` + industry palette
- [x] `src/lib/brand/` — LLM reads prompt → name + tagline + color system + typography (deterministic fallback when no key)
- [ ] Media-manifest → image-gen at compose time (logo, hero, icon assets)
- [ ] Voice/writing-style slots (`formal|casual|technical`) threaded through copy
- [ ] i18n-ready: RTL, locale packs; region compliance copy
- [ ] Multi-tenancy primitives shipped in every SaaS scaffold by default
- [ ] Industry-specific first-turn flows (doctor-portal triage ≠ trading-dashboard setup)
- [ ] User-segment targeting (power-user vs SMB vs enterprise defaults)

## Branch 5 — Self-improvement loops beyond templates

- [x] Template-quality loop (partial — Branch 2)
- [x] Capability-proposal script (`scripts/propose-capabilities.mjs` — unmapped cluster detection)
- [x] Partner-config freshness flagger (`scripts/refresh-partner-configs.mjs` — >90d untouched)
- [x] Dead-family auto-archiver script (`scripts/archive-dead-families.mjs`)
- [ ] Routing AxGEPA-trained from (prompt, expected-family) synthetic tuples + real ones as they arrive
- [ ] Proposal scripts running on a schedule (workflow + auto-PR)
- [ ] Family-proposal loop: mis-routed-prompt clusters → LLM drafts new family manifest + ship files
- [ ] Meta-optimization: multi-pursue proposers evolve against end-to-end VB pass rate, not proxy metrics

## Branch 6 — DX / contributor tooling

- [x] `pnpm new:family / capability / partner` generators + CONTRIBUTING
- [x] Schema validator + keyword overlap detector
- [x] `scripts/repl.mjs` — CLI: interactive route-test any prompt against live registry
- [x] `scripts/generate-docs.mjs` — auto-build static docs site from manifests
- [x] `scripts/watch.mjs` — hot-reload dev mode (rebuild on registry/ change)
- [ ] `docs/explorer/` — web page listing all families/capabilities/partners (searchable)
- [ ] Schema → TypeScript types auto-gen (eliminate manual drift)
- [ ] Web playground (paste prompt → see routing + compose + AGENTS.md preview)
- [ ] VS Code extension (manifest autocomplete + inline overlap warnings)

## Branch 7 — Consumer integration depth

- [x] composeFromPrompt, validatePlan, emitBuildoutEvent, listRegistry, promptFragment (TS SDK)
- [x] Python SDK scaffold (`sdks/python/` — `starter_foundry/buildout.py` + `validate_plan.py`, O_APPEND atomicity)
- [ ] Python SDK integration tests + pypi publish workflow
- [ ] Rust SDK (embedded/perf consumers)
- [ ] Webhook notifications: "new family added — add `bun` to your container"
- [ ] Pubsub trace stream: consumers subscribe, we aggregate, privacy-preserving
- [ ] Multi-tenant registry views (per-consumer whitelist/blacklist of families)
- [ ] Rate limits + quotas for heavy consumers
- [ ] GraphQL/gRPC API (beyond npm package)

## Branch 8 — Trust + safety

- [x] `src/lib/sbom.ts` — SBOM per composed scaffold (CycloneDX 1.5)
- [x] `src/lib/safety/secret-scan.ts` — pre-return regex scan for AWS/GitHub/OpenAI/JWT/etc.
- [x] `src/lib/safety/license-check.ts` — GPL/AGPL/SSPL detection with block-vs-warn severity
- [x] Adversarial prompt test suite (`tests/adversarial-prompts.test.ts` — injection, path-traversal, long prompts)
- [x] Weekly CVE sweep workflow (`.github/workflows/cve-sweep.yml`)
- [ ] CVE-aware auto-PR (workflow emits findings; doesn't yet bump)
- [ ] Reproducibility: every compose gets a deterministic seed; bit-identical replay
- [ ] Compliance families: HIPAA, SOC2, PCI, GDPR with baked audit trails

## Branch 9 — Ecosystem position

- [x] `docs/PARTNER-CONTRIBUTION.md` — partner program doc with quality bar + freshness SLA
- [ ] Industry consortium families (HL7-healthcare, FHIR, FinTech-OpenBanking, Legal-LEDES)
- [ ] Community scaffold marketplace: signed third-party family contributions
- [ ] Public benchmarks + leaderboards (agent performance on starter-foundry scaffolds)
- [ ] Research publications (scaffold quality, template-quality loops, agent-benchmark design)
- [ ] Consumer count milestone: 10 → 100 → 1000

## Branch 10 — Production operation

- [x] Weekly CVE sweep with artifact upload (findings-only; auto-PR pending)
- [ ] Canary release: 5% of composes on next version; auto-rollback on regression
- [ ] Multi-region registry replication
- [ ] SLA monitoring + uptime dashboard
- [ ] Chaos tests: stale registry, slow router, partial compose failure
- [ ] Rollback infrastructure for every shipped version

---

## Foundational primitives (build once, every branch uses)

These are the modular libraries that unblock multiple checklist items at once. All shipped as of 2026-04-21.

- [x] **Registry schemas + validator + generators** — Branch 1, 6
- [x] **Scorecard + nightly measurement workflow** — Branch 3, 5, 10
- [x] **Buildout miner + capability-gap detector** — Branch 2, 3, 5
- [x] **Template-quality harness** (harvest/synthesize/judge/audit/run/multi-propose) — Branch 2
- [x] **Consumer SDK** (composeFromPrompt, validatePlan, emitBuildoutEvent, listRegistry, promptFragment) — Branch 7
- [x] **Synthetic-bootstrap library** (`src/lib/synthetic/`) — unblocks Branches 1, 2, 3, 4, 5
- [x] **Brand/asset generation library** (`src/lib/brand/`) — Branch 4
- [x] **SBOM + safety library** (`src/lib/sbom.ts`, `src/lib/safety/{secret-scan,license-check}.ts`) — Branch 8
- [x] **A/B experiment primitive** (`src/lib/ab.ts`) — Branch 3
- [x] **Visual regression primitive** (`src/lib/visual-regression.ts`) — Branch 3, 10
- [x] **Auto-docs generator** (`scripts/generate-docs.mjs`) — Branch 6
- [x] **CLI REPL** (`scripts/repl.mjs`) — Branch 6
- [x] **Hot-reload dev mode** (`scripts/watch.mjs`) — Branch 6
- [x] **Python SDK scaffold** (`sdks/python/`) — Branch 7
- [ ] **Docs explorer site** (`docs/explorer/` static) — Branch 6, 9

## Sequencing

Current phase: **coverage expansion** (Branch 1) — foundational primitives are complete; the flywheel needs more worlds to route to.

1. ~~**Synthetic-bootstrap library first**~~ — done.
2. ~~**Primitive libraries in parallel** (brand, SBOM, safety, AB, visual-regression).~~ — done.
3. ~~**DX primitives** (CLI REPL, auto-docs, explorer) — contributors unblocked.~~ — mostly done; explorer site remaining.
4. **Branch 2 LLM wire in CI** — turn the template-quality flywheel on.
5. **Coverage expansion** (Branch 1) — in flight this session. Queue: mobile, embedded, robotics, verticals, remaining chains.
6. **Ecosystem** (Branch 9) + **Production** (Branch 10) — the final 25% is ecosystem position, not engineering.

**Measurement**: every item is done when a regression test asserts it, the scorecard flow tracks it, or it's wired into a nightly job that commits evidence. No item is "done" by prose.
