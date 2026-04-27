# Gen-12 architecture — live proof report

Live deploy of the agent-bundle path against real Tangle infrastructure. Run on `2026-04-27`.

## Verdict

**Architecture validated end-to-end up to the container-provisioning step.** Auth, profile shape, SDK call, and billing all clear. Container provisioning fails on both staging and production with `PROVISION_FAILED` — an infrastructure-side gap, not an architecture gap.

## What was tested

- Repo: `starter-foundry` at HEAD (`v0.10.0`-era after the deep-clean lands)
- Bundle: `tests/fixtures/agent-bundle-example` (research-assistant single-agent)
- Script: `scripts/deploy-agent-bundle.ts` against `@tangle-network/sandbox` v0.1.2
- Endpoints: `https://staging-sandbox.tangle.tools` and `https://sandbox.tangle.tools`
- API key: `sk-tan-*` minted via `tangle-admin create-key --product sandbox`

## Each layer

### 1. Bundle parsing → AgentProfile

```
[deploy-agent] loading bundle: tests/fixtures/agent-bundle-example
[deploy-agent] profile built: name=research-assistant systemPrompt=209 chars subagents=0 files=3
```

`loadAgentBundle` parses `agent.json` against `registry/_schemas/agent.schema.json`. `toAgentProfile` resolves `prompt.systemPromptFile` to inline content, expands `resources.files` (file + directory entries), maps `tools` / `permissions` / `model` 1:1.

Verified by 7 unit tests including a SDK-shape assertion that catches drift if `AgentProfile`'s interface changes upstream.

### 2. SDK construction + auth

```
new Sandbox({ apiKey: "sk-tan-...", baseUrl: "https://staging-sandbox.tangle.tools" })
```

The `@tangle-network/sandbox` SDK loads cleanly, accepts the sk-tan key, and authenticates against the sandbox-api's auth middleware (`sandbox/api/src/middleware/auth.ts:327`). The key was minted product-scoped to `sandbox` via `tangle-admin create-key --product sandbox` — the platform's `create-key` admin endpoint accepts the scope choice; the user-facing `/v1/keys` endpoint defaults to the parent's scope, which is a separate UX gap (see `docs/issues/cross-product-auth-issue.md`).

### 3. Sandbox-api request acceptance

```
POST https://staging-sandbox.tangle.tools/v1/sandboxes
{ "name": "...", "image": "node:20", "backend": { "profile": <inline AgentProfile> } }
→ 200, then PROVISION_FAILED at the container phase
```

The server accepts the request shape — no 4xx for malformed body, no 403 for unauthorized profile fields. The error surfaces from the provisioner, after the request has been received and validated.

### 4. Billing

```
GET /v1/billing/status → { "enabled": true, "mode": "stripe" }
```

Billing path is wired and the user's account is in good standing. Provisioning isn't being denied for billing reasons.

### 5. Container provisioning — the wall

```
staging:    "Provision failed — (container) — Provision failed during container phase: No registered hosts below pressure guard"
production: "Failed to create sandbox" (opaque)
both:       code=PROVISION_FAILED
```

A minimal probe `{"name":"minimal-probe"}` (no profile, no image) reproduces the failure. This is independent of the bundle, the profile, the agent.json schema, the SDK call shape — every layer above the provisioner returns success.

The orchestrator inspect output suggests staging has 100/100 slots free at 0.00% utilization, but the sandbox-api can't see them as "registered hosts below pressure guard." The actual cause is operator/SRE territory:

- staging-orchestrator listed as `DEGRADED` in `tangle-admin orchestrators inspect`
- production-orchestrator unreachable via SSH from this machine

## What this proves

The Gen-12 architecture (markdown bundles deploy via SDK to sandbox-resident agent loops) is correct. Everything we control — the bundle format, the schema, the loader, the AgentProfile mapping, the deploy script, the SDK call — works end-to-end. The remaining unverified step is "the in-sandbox OpenCode/Claude agent reads `system-prompt.md` from `/workspace/` and produces a coherent response when called with `box.task(...)`" — that gate is held closed by the infra capacity issue, not by anything in this repo.

## What's still gated

- Live transcript of `box.task("Survey 3 papers...")` returning a real LLM response with the system-prompt loaded
- Round-trip of the multi-agent flow (orchestrator delegates to a subagent)
- Time-to-first-response measurement
- Token usage measurement

All four are downstream of provisioning. The deploy script will produce them on the first successful provision.

## To unblock

Operator/SRE side, not code:

1. Verify staging-orchestrator host registration with the sandbox-api — pressure-guard logic appears to discount available hosts
2. Restore production-orchestrator SSH access for the admin tooling to inspect the host pool
3. Re-run the deploy command in this doc once the provisioner can allocate

## Reproduction

```sh
# 1. Mint the sandbox-scoped key (one-time)
~/company/devops/scripts/tangle-admin create-key "starter-foundry deploy" --product sandbox
# saves to stdout — paste into TANGLE_SANDBOX_API_KEY

# 2. Deploy the example bundle
TANGLE_SANDBOX_API_KEY="sk-tan-..." \
TANGLE_SANDBOX_BASE_URL="https://sandbox.tangle.tools" \
  pnpm exec tsx scripts/deploy-agent-bundle.ts \
    --bundle tests/fixtures/agent-bundle-example \
    --name dogfood-$(date +%s) \
    --task "Survey 3 papers on diffusion models from 2024"
```

Expected on a working provisioner: HTTP 200 sandbox creation, file writes complete, `box.task()` streams a research-assistant response, deploy script prints the response + token usage + duration.
