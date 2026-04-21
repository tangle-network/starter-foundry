# CHANGELOG

## v0.5.4 (2026-04-20, @ 134b0a6)

**Generated range:** `HEAD~30..HEAD`

### New families
- `agent-swarm-ts` — Multi-agent swarm family — supervisor/worker orchestration with shared state, tool-routing, and handoff protocols. Based on LangGraph state 
- `bun-http` — Bun HTTP API starter using Bun.serve() — zero-transpile TS, native Bun runtime, instant cold start.
- `deno-edge` — Deno runtime HTTP API starter using Deno.serve — zero-transpile TS, secure-by-default permissions, Deno Deploy-compatible.
- `vllm-server` — vLLM-based LLM inference server with OpenAI-compatible endpoints. Production-shape model serving — PagedAttention memory, continuous batchin
- `wasm-rust` — Rust-compiled-to-WASM starter with wasm-bindgen bindings and a Vite frontend that loads + calls the module. For compute-heavy browser work (

### New capabilities
- `capability:banking-baas` — Banking-as-a-Service integration — account opening, ACH transfers, card issuance, ledger management. Ships provider-neutral wrappers for Uni
- `capability:code-editor` — Browser code editor using CodeMirror 6 — syntax highlighting, theming, line numbers, autocomplete. For AI coding assistants, markdown editor
- `capability:date-utils` — date-fns for date parsing, formatting, arithmetic, and relative time. Tree-shakeable, locale-ready. For any product that displays, schedules
- `capability:stripe-checkout-onetime` — Stripe Checkout for one-time purchases — hosted or embedded checkout session for single-purchase products (courses, digital downloads, event
- `capability:stripe-connect` — Stripe Connect — multi-party / marketplace payments. Onboard connected accounts (Express or Custom), route charges to sellers, handle platfo
- `capability:stripe-metered` — Stripe usage-based billing via Billing Meters — report events as they happen, Stripe aggregates and bills on your cadence. For AI products (
- `capability:tangle-gpu-provider` — GPU blueprint capability — operators declare GPU resource requirements (CUDA compute capability, VRAM, count). Jobs run on GPU-enabled opera
- `capability:tangle-mpp` — MPP (Machine Payments Protocol) capability for tangle-blueprint — agent-to-agent payment rails with delegation, budget caps, and spend attes
- `capability:tangle-remote-provider` — Remote provider blueprint capability — the blueprint calls out to external services (LLM providers, RPC endpoints, SaaS APIs) with credentia
- `capability:tangle-tee` — TEE (Trusted Execution Environment) blueprint capability — operators run jobs inside an enclave (Intel TDX / AWS Nitro / Phala dStack) and p
- `capability:tangle-x402` — x402 payments capability for tangle-blueprint — each job dispatch carries an x402 payment, operators verify signature + amount before execut
- `capability:zk-browser` — Client-side ZK proof generation — snarkjs + circomlibjs + circomlib, a zkProof helper, and notes on hosting the proving key. For browser-nat

### New partners
- `chainlink` — Partner pack for Chainlink — price feeds, VRF, Automation, CCIP cross-chain messaging. Biases frontend + contract scaffolds toward the Chain
- `sui` — Partner pack for Sui — Move-based L1 with object-centric model, parallel execution, zkLogin. Biases toward Sui Move contracts + the @mysten/
- `tempo` — Partner pack for Tempo — Paradigm's payments-optimized L1 with sub-second settlement, high throughput, EVM-compatible. Biases toward payment

### Commits (30)
- feat(template_v1): full harvest→synthesize→judge→audit→run pipeline (134b0a6)
- feat: S+ tier infrastructure — 9 pursuits wired, auto-improvement loop live (cdfa356)
- feat(agent-context): Placeholders + firstSteps + gotchas in AGENTS.md (66b1705)
- feat: 3 partners + stripe breakdown + banking-baas + agent-swarm + tangle expansion + RLM idea-seeds (#25) (ca7f16d)
- feat: close slate — deno-edge + vllm-server families, code-editor + date-utils capabilities, packageDeps migration (#24) (db8f10e)
- feat(capability:zk-browser): close top scaffold gap (snarkjs 4×/4× fail on zk-mixer-ui) (#19) (dc52e89)
- feat(bun-http): new family — Bun runtime HTTP APIs (#20) (0570d99)
- chore(families): version sweep — latest stable minors across 10 families (#21) (f699ee7)
- feat(wasm-rust): new family — Rust-to-WASM with Vite frontend (#22) (dfb8060)
- feat(sdk): emitBuildoutEvent — programmatic telemetry ingestion entrypoint (#23) (4b286c3)
- fix(capability-gaps): rewrite detector — 0 → 102 classified agent installs (#17) (36f05ce)
- fix(forge-foundation): trim foundry.toml to what agents actually keep (kills 100% rewrite rate) (#18) (7fbf2e7)
- fix(compose+families): 3 blueprint-agent findings (#1 vite pins + #2 workspace auto-dispatch + #3 partner scrub) (#16) (6bc180d)
- fix(capability-inferrer): prune generic SDK mappings (kills zk-mixer-ui false positive) (#14) (d7f5840)
- chore: sync pnpm-lock.yaml — unblocks CI (#15) (8ffb64f)
- multi-pursue R3 pivot: signal collapse (36/37 audit pass) (#13) (c697a58)
- fix(react-vite-ts): minimal App.tsx skeleton (kills 12× rewrite signal) (#12) (d6a82b7)
- release(0.5.4): planner module split + deep-clean (f571edc)
- deep-clean: remove 3 dead fns + tighten exports + knip config (#11) (1667386)
- feat(tier1): router fix (-87% capability gaps) + tangle toolchain + foundry defaults + integration docs (#10) (1ea624b)
- feat(buildout-pipeline): mine 133 sessions → router + template bug signal (#9) (84d9388)
- fix(scaffolds): 4 broken registry templates — audit 86.5% → 97.3% (#8) (6596856)
- fix(audit): capture stdout + stderr for every scaffold-quality phase (#7) (3dd6dd6)
- multi-pursue R2: corpus relabel (+17.7pp Jaccard) + session-trace collector (#6) (aa33acc)
- feat(rlm): gated LLM rewriter + product brief + multi-pursue training infra (#5) (1cea736)
- Meta-harness Gen 1: -47% p95, +27pp ideasai capHit (#4) (7906bc1)
- chore: pnpm i (9119d4e)
- feat(agent-context): numbered steps instead of prose wall (#3) (2efa1fa)
- release(0.5.3): grant packages:write + idempotent publish steps (b0afb41)
- release(0.5.2): also publish to GitHub Packages (5507bfb)

### Registry state at HEAD
- families: 45
- capabilities: 103
- partners: 9

### Consumer action items
- Ensure your bench container has the toolchains any new families require (e.g. `bun`, `deno`, `wasm-pack`, `vllm`).
- Re-emit your buildout traces via `emitBuildoutEvent` — new family IDs will be classified by the detector.
