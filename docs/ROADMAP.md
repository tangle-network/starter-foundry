# ROADMAP — from 50% (today) to 100% (scaffold standard)

**North star**: prompt → composed project in <5s, agent ships feature work on turn 1, every surface auto-improves from observed agent behavior, extensible to any domain in hours.

**Bootstrap principle**: we don't wait for real user data. Synthetic prompts from strong models (Opus / GPT / o4 / Claude) seed every loop — template quality, routing training, capability proposal, family coverage. Real data replaces synthetic as it arrives.

**Architectural principle**: every branch shares primitives. `synthetic/`, `ab/`, `safety/`, `sbom/`, `visual-regression/`, `brand/` are foundational libraries the checklists below call into. Build the library once; every checklist item is a wiring job.

---

## Branch 1 — Coverage breadth (routable worlds)

Target: +60 families, +80 capabilities, +20 partners. Every new surface bootstraps from synthetic prompts + validated end-to-end before merge.

- [ ] Mobile: `expo-rn-rich` (Skia/Reanimated/Navigation stack), `flutter-app`, `kotlin-multiplatform`, `swiftui-expo`
- [ ] Game engines: `threejs-game`, `phaser-game`, `bevy-web`, `godot-web`, `pixijs-game`, `unity-web-proxy`
- [ ] ML/AI serving: `sglang-server`, `triton-server`, `tgi-server`, `ollama-server`, `vllm-distributed`, `skypilot-serving`, `lora-training`, `rag-pipeline-py`
- [ ] Native desktop: `tauri-menubar`, `tauri-tray`, `electron-native-os`
- [ ] Embedded: `esp32-rust`, `stm32-rust`, `rp2040-embassy`, `arduino-cpp`
- [ ] Robotics: `ros2-node-py`, `ros2-node-rust`, `px4-mavsdk`
- [ ] WebGPU compute: `webgpu-inference`, `webgpu-render`
- [ ] Scientific / data: `jupyter-book`, `observable-notebook`, `streamlit-advanced`
- [ ] Video/audio: `livekit-sfu`, `hls-origin`, `realtime-audio-ts`
- [ ] Static SSGs: `astro-static`, `eleventy-static`, `hugo-static`, `zola-static`
- [ ] Industry verticals as families: `healthcare-hipaa-backend`, `fintech-ledger-backend`, `legal-case-mgmt`, `k12-edtech`, `crm-backend`, `ecommerce-headless`
- [ ] Chains: `monad-evm`, `aptos-move`, `sei-evm`, `celestia-da`, `avalanche-c`, `linea-evm`
- [ ] Stablecoins/partners: `tether`, `usdc-circle`, `hyperliquid`, `lens`, `farcaster`
- [ ] Agent modalities: `voice-first-agent`, `vision-first-agent`, `multimodal-agent`

Pattern for each: `pnpm new:family` → synthetic bootstrap drafts manifest + buildHints → human verifies → audit green → PR.

## Branch 2 — Template-quality loop completion

- [x] harvest → synthesize (deterministic) → judge → audit → apply (CLI `run.ts`)
- [ ] LLM synthesizer wired (router.tangle.tools key in CI; `--llm` flag on run.ts)
- [ ] Multi-proposer synthesis (3 parallel candidates; judge picks; escalate on ties)
- [ ] Nightly run across top-10 rewritten templates; auto-opens PRs above threshold
- [ ] Judge-of-judges: LLM judge calibrated against human-labeled gold set; Spearman tracked
- [ ] Reward tuned against downstream VB pass-rate (not just rewrite-count proxy)
- [ ] New-family synthesis: "I want a family for X" → LLM reads N peer families → drafts + audits + promotes
- [ ] Auto-revert on rewrite-rate regression
- [ ] Cross-template cascade: dep bump in one capability propagates consistently across families

## Branch 3 — Measurement depth

- [x] 10 scorecard flows with productValueClaims; nightly snapshot
- [ ] Visual regression pass: compose → screenshot → diff against golden set
- [ ] Per-scenario historical trend (week-over-week) committed to `.evolve/trends/`
- [ ] Lint-aware rewrite delta (rewrites of lint-clean vs lint-broken code counted differently)
- [ ] Cost-per-buildout: token + LLM-call estimator per scaffold
- [ ] A/B experiment harness: ship variant to X% of composes, measure delta
- [ ] Real-time telemetry stream (consumer SDK → aggregator → live dashboard)
- [ ] Quality-vs-speed Pareto chart
- [ ] Coverage heatmap: (industry × runtime × partner) grid, gaps auto-flagged

## Branch 4 — Personalization depth

- [x] `personalize.json` + `personalize.css` + industry palette
- [ ] `src/lib/brand/`: LLM reads prompt → name + tagline + color system + typography (bootstrap: Opus/GPT)
- [ ] Media-manifest → image-gen at compose time (logo, hero, icon assets)
- [ ] Voice/writing-style slots (`formal|casual|technical`) threaded through copy
- [ ] i18n-ready: RTL, locale packs; region compliance copy
- [ ] Multi-tenancy primitives shipped in every SaaS scaffold by default
- [ ] Industry-specific first-turn flows (doctor-portal triage ≠ trading-dashboard setup)
- [ ] User-segment targeting (power-user vs SMB vs enterprise defaults)

## Branch 5 — Self-improvement loops beyond templates

- [x] Template-quality loop (partial — Branch 2)
- [ ] Routing AxGEPA-trained from (prompt, expected-family) synthetic tuples + real ones as they arrive
- [ ] Capability-proposal loop: unmapped agent-install clusters → LLM proposes new capability → human review
- [ ] Partner-config refresh: LLM re-reads partner docs quarterly; proposes config updates
- [ ] Family-proposal loop: mis-routed-prompt clusters → LLM drafts new family manifest + ship files
- [ ] Dead-family auto-archiver: 0 routing + 0 installs for 90 days → deprecation PR
- [ ] Meta-optimization: multi-pursue proposers evolve against end-to-end VB pass rate, not proxy metrics

## Branch 6 — DX / contributor tooling

- [x] `pnpm new:family / capability / partner` generators + CONTRIBUTING
- [x] Schema validator + keyword overlap detector
- [ ] `scripts/repl.mjs` — CLI: interactive route-test any prompt against live registry
- [ ] `scripts/generate-docs.mjs` — auto-build static docs site from manifests
- [ ] `docs/explorer/` — web page listing all families/capabilities/partners (searchable)
- [ ] Schema → TypeScript types auto-gen (eliminate manual drift)
- [ ] Hot-reload dev mode (`starter-foundry watch` — rebuild on registry/ change)
- [ ] Web playground (paste prompt → see routing + compose + AGENTS.md preview)
- [ ] VS Code extension (manifest autocomplete + inline overlap warnings)

## Branch 7 — Consumer integration depth

- [x] composeFromPrompt, validatePlan, emitBuildoutEvent, listRegistry, promptFragment (TS SDK)
- [ ] Python SDK (`starter_foundry/` package; thin HTTP client over a hosted endpoint or local node bridge)
- [ ] Rust SDK (embedded/perf consumers)
- [ ] Webhook notifications: "new family added — add `bun` to your container"
- [ ] Pubsub trace stream: consumers subscribe, we aggregate, privacy-preserving
- [ ] Multi-tenant registry views (per-consumer whitelist/blacklist of families)
- [ ] Rate limits + quotas for heavy consumers
- [ ] GraphQL/gRPC API (beyond npm package)
- [ ] SDK integration tests for all above

## Branch 8 — Trust + safety

- [ ] `src/lib/sbom.ts` — SBOM per composed scaffold (CycloneDX format)
- [ ] CVE-aware templates: weekly dep-CVE scan; auto-PR bumps
- [ ] License-aware routing: refuse GPL deps for commercial-intent prompts; flag on compose
- [ ] `src/lib/safety/secret-scan.ts` — pre-return scan of composed output for leaked creds
- [ ] Adversarial prompt test suite (injection, jailbreak, capability-escalation)
- [ ] Reproducibility: every compose gets a deterministic seed; bit-identical replay
- [ ] Compliance families: HIPAA, SOC2, PCI, GDPR with baked audit trails

## Branch 9 — Ecosystem position

- [ ] Partner contribution program: partners upstream their configs + templates via PR
- [ ] Industry consortium families (HL7-healthcare, FHIR, FinTech-OpenBanking, Legal-LEDES)
- [ ] Community scaffold marketplace: signed third-party family contributions
- [ ] Public benchmarks + leaderboards (agent performance on starter-foundry scaffolds)
- [ ] Research publications (scaffold quality, template-quality loops, agent-benchmark design)
- [ ] Consumer count milestone: 10 → 100 → 1000

## Branch 10 — Production operation

- [ ] Canary release: 5% of composes on next version; auto-rollback on regression
- [ ] Multi-region registry replication
- [ ] Weekly CVE sweep with auto-PR
- [ ] SLA monitoring + uptime dashboard
- [ ] Chaos tests: stale registry, slow router, partial compose failure
- [ ] Rollback infrastructure for every shipped version

---

## Foundational primitives (build once, every branch uses)

These are the modular libraries that unblock multiple checklist items at once. Ship these first; everything downstream becomes a wiring job.

- [x] **Registry schemas + validator + generators** — Branch 1, 6
- [x] **Scorecard + nightly measurement workflow** — Branch 3, 5, 10
- [x] **Buildout miner + capability-gap detector** — Branch 2, 3, 5
- [x] **Template-quality harness** (harvest/synthesize/judge/audit/run) — Branch 2
- [x] **Consumer SDK** (composeFromPrompt, validatePlan, emitBuildoutEvent, listRegistry, promptFragment) — Branch 7
- [ ] **Synthetic-bootstrap library** (`src/lib/synthetic/`) — unblocks Branches 1, 2, 3, 4, 5
- [ ] **Brand/asset generation library** (`src/lib/brand/`) — Branch 4
- [ ] **SBOM + safety library** (`src/lib/sbom.ts`, `src/lib/safety/`) — Branch 8
- [ ] **A/B experiment primitive** (`src/lib/ab.ts`) — Branch 3
- [ ] **Visual regression primitive** (`src/lib/visual-regression.ts`) — Branch 3, 10
- [ ] **Auto-docs generator** (`scripts/generate-docs.mjs`) — Branch 6
- [ ] **CLI REPL** (`scripts/repl.mjs`) — Branch 6
- [ ] **Docs explorer site** (`docs/explorer/` static) — Branch 6, 9

## Sequencing

1. **Synthetic-bootstrap library first** — it unblocks 5 branches.
2. **Branch 2 LLM wire** — the flywheel starts spinning.
3. **Primitive libraries in parallel** (brand, SBOM, safety, AB, visual-regression).
4. **DX primitives** (CLI REPL, auto-docs, explorer) — contributors unblocked.
5. **Coverage expansion** — now that adding a family is cheap, churn through Branch 1.
6. **Ecosystem** (Branch 9) + **Production** (Branch 10) — the final 25% is ecosystem position, not engineering.

**Measurement**: every item is done when a regression test asserts it, the scorecard flow tracks it, or it's wired into a nightly job that commits evidence. No item is "done" by prose.
