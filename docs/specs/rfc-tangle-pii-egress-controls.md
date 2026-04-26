# RFC: Tangle Platform PII Egress Controls

| | |
|---|---|
| **Status** | Draft |
| **Authors** | starter-foundry, with input from agent-runtime catalog |
| **Owners (proposed)** | Tangle gateway team, sandbox-sdk team |
| **Date** | 2026-04-26 |
| **Tracking** | tangle-network/router#? · tangle-network/sandbox-sdk#? |
| **Consumes** | `agent-base:privacy` (starter-foundry; layer 3, shipped) |

---

## Summary

Add two platform-level egress controls — a **gateway PII scanner** (layer 1) and a **sandbox-runtime log filter** (layer 2) — to backstop the bundle-level filter that already exists in `@tangle-network/starter-foundry/registry/layers/agent-base/privacy/`. Default behavior is **detect-and-tag**, not block. Block-on-detect is opt-in via deployment policy (HIPAA-mode, PCI-mode). The two layers + the bundle layer compose into defense-in-depth: bundles do correct field-aware redaction at intentional egresses; platform layers catch what bundles miss.

## Motivation

Tangle's current isolation story:

- **OS sandbox** (sandbox-sdk): process boundary, network egress whitelist, no-new-privileges, capability dropping. Bounds *what* an agent can do.
- **Gateway** (router.tangle.tools): TLS, routing, rate limits, billing. Bounds *who* can call.
- **Bundle layer** (`agent-base:privacy`): field-aware redaction at intentional egresses inside the agent. Bounds *what data the agent voluntarily exports*.

There is one gap left: **the agent voluntarily exports data the bundle author forgot to filter**. The chain-of-thought spills patient SSN into observability. The agent's tool output dumps a session id to a log. A bundle author updates a methodology guide and a new egress slips past the filter pass that the previous methodology had.

Bundle-level filtering is correct: only the bundle knows which fields are sensitive vs incidental, which receivers are trusted vs not. But "correct policy at every egress in every bundle on every commit" is a coverage problem that grows linearly with catalog size. We have 50 bundles today; we'll have hundreds. **The platform must provide a backstop.**

## Goals

1. **Detect-and-tag** every egress that contains structured PII (SSN, phone, credit-card-with-Luhn, email, IP, API keys, JWT/PEM keys, DOB-with-context). The gateway adds an `X-Tangle-PII-Detected` header; the runtime tags log lines with `pii_types`.
2. **Opt-in block** for compliance-mode deployments: `tangle-deploy --policy hipaa` refuses to forward unmarked PII; agents must explicitly assert allowed PII via `X-Tangle-PII-Allowed: <types>` header.
3. **Auditable**: every detection event is signed and persisted to the existing audit chain (consumer pattern from `agent-base:integrity` if shipped, or platform-side equivalent). Tampering detectable.
4. **Operationally cheap**: ≤10ms p50 latency added at the gateway; no measurable cost on the runtime log path under normal load.
5. **Bundle-compatible**: the bundle-level layer (`agent-base:privacy`) and the platform layers share the same atom (`detectPII(text)`). One set of detectors, three call sites.

## Non-goals

- **Field-aware redaction at the platform layer** (only the bundle has field semantics)
- **Replacing the bundle-level filter** (platform is backstop, not primary)
- **Inspecting LLM-provider traffic** (out of scope; provider TLS is end-to-end)
- **Deep semantic NER at the gateway** (latency cost; defer to bundles + their nerBackend)
- **Blocking by default** (false-positive blast radius too high — see Risks)

## Design

### Layer 1: Gateway PII Scanner (`router.tangle.tools`)

Adds an inline scanner to the egress path of every sandbox-originated request.

```
sandbox → gateway egress middleware → upstream
              │
              ├── 1. read body (size cap: 1 MB; over → tag as "scanner-bypassed-size")
              ├── 2. invoke detector pool (regex; sub-ms typical)
              ├── 3. if spans found:
              │      a. add header X-Tangle-PII-Detected: <comma-separated types>
              │      b. add header X-Tangle-PII-Span-Count: <n>
              │      c. log to gateway audit stream (signed entry)
              ├── 4. if deployment policy is "block" AND no X-Tangle-PII-Allowed header:
              │      → return 403 with body { error: "pii-blocked", types, hint: "set X-Tangle-PII-Allowed" }
              └── 5. otherwise: forward unchanged
```

**Detector source**: same regex set as `agent-base:privacy/detectors.ts`. Ship as a shared package `@tangle-network/pii-detectors` consumed by both the gateway and the bundle layer.

**Span size cap**: 1 MB body. Over-cap requests get tagged `X-Tangle-PII-Scanner-Bypassed: size` and forwarded — the operator's policy decides whether to block on bypass.

**Latency budget**: scanner runs synchronously on the egress path. p50 target: ≤5ms on 10 KB body. p99 target: ≤20ms. Falls back to async (pre-tag at ingress, post-detect after forward) if the inline budget breaks.

**Caching**: detector compilation is module-load-time. Per-request work is regex iteration. No per-request allocation of patterns.

### Layer 2: Sandbox Runtime Log Filter (`sandbox-sdk`)

The sandbox emits log streams (LLM chain-of-thought, tool I/O, stderr) to the host's observability collector. This stream is the highest-volume PII leak surface — bundles do not always filter their own log.write() calls.

```
agent process → stderr/stdout → sandbox runtime collector → observability backend
                                          │
                                          ├── 1. line buffer (cap: 64 KB per line)
                                          ├── 2. detector pool (same shared package)
                                          ├── 3. if spans found AND no `X-Allow-PII` marker on the line:
                                          │      a. apply default redaction (last-4 visible for ssn/cc)
                                          │      b. attach metadata: { pii_types: [...], pii_span_count: n }
                                          │      c. signed audit entry (subject: agent-id, target: log-line)
                                          └── 4. forward to backend
```

**Bundle opt-out**: if the bundle wrote a log line and *intentionally* needs raw PII (the doctor agent reading a patient record into the log for debugging), it prefixes the line with `X-Allow-PII: ssn,phone` (the actual marker is a structured envelope; the runtime extracts it). Audit-logged so an auditor sees who chose to bypass and when.

**Default redaction**: same shape as `agent-base:privacy` — last-4 visible for SSN and credit card; full redaction for the rest. Operators can override at runtime config.

### Layer 3: Bundle Filter (`agent-base:privacy` — already shipped)

For reference, the existing bundle-level filter calls the same detectors at intentional egress points with field-aware policies the platform can't know:

```ts
// In a doctor bundle's methodology
const { redacted } = await redactPII(notes, {
  redactWith: (span) => span.type === 'ssn' ? `***-**-${span.value.slice(-4)}` : `[${span.type}]`,
  // Operator opted into HIPAA-mode → drop low-confidence spans aggressively
  minConfidence: 'medium',
})
await webhookOut(target, { ...payload, notes: redacted }, opts)
```

Because all three layers use the same atom (`detectPII`), a span that would be flagged by the gateway is the same span the bundle scrubs at egress. No semantic drift.

### Shared package: `@tangle-network/pii-detectors`

Pull the structured detectors out of `agent-base:privacy/detectors.ts` into a published package. The gateway, sandbox-runtime, and bundle layer all consume it. Single source of truth:

- Add a detector → all three layers get it
- Fix a regex false positive → all three layers fix it
- Update Luhn / context-anchor logic → one diff

The package is published from the same monorepo as the gateway and sandbox-sdk; SF consumes via the bundle layer.

### Configuration surface (deployment policy)

Operator's deployment manifest declares the policy:

```yaml
# tangle-deploy.yaml
sandbox:
  pii_policy:
    mode: detect           # one of: detect | block | strict
    types_blocked: [ssn, credit-card, dob]   # mode=block: which types trigger 403
    types_allowed: [email, phone]              # always permit (e.g. CRM agents)
    log_filter: redact     # one of: redact | block | passthrough
    audit_destination: /workspace/.audit/pii-events.jsonl
```

Defaults: `detect` mode, `redact` log filter, no types blocked. Compliance-mode deployments flip to `block` / `strict` with explicit types_blocked.

## Threat model + non-coverage

**Defends against:**
1. Bundle author forgets to call `redactPII` at a new egress point (caught at gateway + runtime)
2. Bundle author calls `redactPII` but with the wrong allow-list (caught at gateway if PII still leaks)
3. LLM emits unexpected PII in chain-of-thought (caught at runtime log filter)
4. Operator runs a HIPAA deployment and wants hard-block guarantees (block mode)
5. Auditor needs to verify "no SSN crossed any egress in March" (signed audit chain)

**Does NOT defend against:**
- Bundle author who intentionally sets `X-Tangle-PII-Allowed` for everything (operator policy concern)
- Compromised gateway (TLS termination is upstream of this layer)
- Side-channel leakage via timing or response shape (out of scope)
- Encoded/obfuscated PII (base64'd SSN — semantic detection is bundle's job, not platform's)
- LLM-provider-side retention (provider TLS is end-to-end; their retention policy is the contract)

## Risks

| Risk | Mitigation |
|---|---|
| **False positives at the gateway break legitimate traffic.** A 16-digit order ID matches the credit-card regex without Luhn validation. | Detectors include Luhn; private-IP/public-IP discrimination at confidence; `minConfidence` floor in the policy. |
| **Latency regression at the gateway.** | Hard p50/p99 budgets (5ms / 20ms); fallback to async if budget broken; per-route opt-out via header for known-clean routes. |
| **The "block by default" foot-gun.** | We do NOT default-block. Operators must explicitly opt into block-mode, and the policy file is reviewed at deploy time. |
| **Detector drift between layers.** | Single shared package `@tangle-network/pii-detectors`. CI test in monorepo runs the same suite against gateway + runtime + bundle. |
| **High-volume log streams overwhelm the runtime filter.** | Per-line size cap (64 KB) + per-stream rate cap (configurable). Over-cap lines tagged `pii_filter_skipped: size` and forwarded. |
| **Operator's audit chain corruption.** | Each detection event is hash-chained from the previous; `verifyDay()` (existing pattern from agent-base:integrity audit) detects tampering. |

## Phased rollout

| Phase | Scope | Owner | Exit criteria |
|---|---|---|---|
| 0 | Extract `@tangle-network/pii-detectors` shared package from SF's `agent-base:privacy/detectors.ts`. Publish 0.1.0. | sf | published; SF bundle consumes from npm |
| 1 | Gateway scanner: `detect` mode only (tag header, audit log). No block. | gateway | p50 ≤5ms; staging deploy; canary 5% prod traffic; no false-positive escalations in 7 days |
| 2 | Runtime log filter: `redact` mode only. | sandbox-sdk | p50 ≤2ms per line; canary 5% sandboxes; observability backend confirms tags landed |
| 3 | Block mode + policy YAML. | gateway | one HIPAA-policy partner deployment running for 30 days with zero unintended blocks |
| 4 | NER backend integration spec (operator-supplied subprocess; latency budget per call) | platform RFC follow-up |

Each phase is reversible (feature flag at the gateway / runtime). Phase 0 is the prerequisite — no platform work happens until detectors are in their own package.

## Alternatives considered

1. **Block by default at the gateway.** Rejected: false-positive blast radius too high; breaks legitimate doctor / wealth-manager / legal use cases that need PII to do the job.
2. **Push everything to the bundle layer (no platform integration).** Rejected: coverage problem grows with catalog size; impossible to audit "every bundle correctly filtered every egress."
3. **Encrypt every egress payload, decrypt at the receiver.** Rejected: doesn't address logs (which are the highest-leak surface), doesn't address the "agent shouldn't have written it in the first place" failure mode, and adds key management complexity.
4. **Outsource detection to AWS Comprehend / Google DLP.** Rejected: adds a per-request external API call (latency + cost + dependency); detector portability is more valuable than NER quality at the structured-PII tier.
5. **Bundle-only with no platform layers.** Considered seriously. The case for platform layers is the coverage problem; if the catalog stays small, bundle-only is sufficient. We're past that scale.

## Open questions

1. **Where does the detector package live?** Proposed: `tangle-network/pii-detectors` (its own repo) or `tangle-network/sandbox-sdk/packages/pii-detectors`. The latter avoids cross-repo version drift between the gateway and sandbox.
2. **Should the gateway scanner also run on *ingress*?** Inbound traffic is mostly user prompts, which carry the user's own PII intentionally. Probably no — but worth confirming with the legal/compliance read.
3. **What's the right shape for the `X-Tangle-PII-Allowed` header?** Comma-separated types is simple; structured (signed JWT) is harder to spoof. Phase 3 decision.
4. **NER backend wiring for the gateway** — too expensive to run a 50M-param model inline. Options: async post-tag, off-host scanner, or operator-deployed sidecar. Phase 4 RFC.

## Acceptance

This RFC is accepted when:

- [ ] `@tangle-network/pii-detectors` is published 0.1.0 with the SF-current detector set
- [ ] Gateway phase 1 runs in staging with p50 ≤5ms over a 24-hour soak
- [ ] Runtime phase 2 redacts a representative log volume (1M lines/day) with no observed false positives over 7 days
- [ ] At least one bundle (doctor / wealth-manager / DV-coach) demonstrates correct interaction across all three layers
- [ ] Platform docs published; operator deployment guide includes a worked HIPAA-policy example

## References

- `@tangle-network/starter-foundry` — `registry/layers/agent-base/privacy/files/lib/privacy/` — reference implementation of layer 3
- [`openai/privacy-filter`](https://github.com/openai/privacy-filter) — Apache-2.0 NER-based redaction; candidate for Phase 4 nerBackend integration
- [Microsoft Presidio](https://github.com/microsoft/presidio) — alternative NER backend
- AWS Comprehend Detect-PII — paid alternative for operators willing to pay per-request
- Luhn algorithm (ISO/IEC 7812-1) — credit-card validation built into structured detectors
