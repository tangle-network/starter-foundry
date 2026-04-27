# Threat Modeling Template

## Overview
Systematically identify threats against a system component or data
flow. STRIDE-by-element is the workhorse method; combine with
dataflow diagrams (DFDs) and trust boundaries. The output is a
ranked list of threats with mitigations and explicit residual risk.

## When to use
Trigger when the user is designing a new system, adding a new data
flow to an existing one, or auditing for security gaps. For
post-exploit incident response, use vulnerability-triage.md. For
architecture-level review, use security-architecture-review.md.

## Method

1. **Define scope and assets.** What system, what data, what
   trust assumptions? List the assets to protect (PII, credentials,
   crypto material, billing data, IP) with sensitivity tier.
2. **Draw the DFD.** Sources, sinks, processes, data stores, data
   flows, and *trust boundaries*. Trust boundaries are where
   threats concentrate — every flow that crosses one is a threat
   surface.
3. **Apply STRIDE per element.** For each component / flow / store:
   - **S**poofing: can an attacker impersonate a user or service?
     Mitigation usually = authentication + identity binding.
   - **T**ampering: can data be modified in transit or at rest?
     Mitigation = integrity (HMAC, signed tokens, write-once log).
   - **R**epudiation: can an action be denied without proof?
     Mitigation = audit log with non-repudiable signatures.
   - **I**nformation disclosure: can sensitive data leak?
     Mitigation = encryption + access control + minimal
     disclosure.
   - **D**enial of service: can the system be made unavailable?
     Mitigation = rate limiting, isolation, graceful degradation.
   - **E**levation of privilege: can a low-priv actor gain
     high-priv access? Mitigation = least privilege + privilege
     separation.
4. **Rate each threat.** DREAD is one option but contested
   (Microsoft deprecated it). Practical alternative: severity
   (Critical / High / Medium / Low) × likelihood, derived from:
   - Pre-conditions (attacker position, prior compromise needed).
   - Skill required (script-kiddie / tooling-exists / novel).
   - Detection time (logged + alerted vs silent).
   - Blast radius (one user / one tenant / all customers).
5. **Propose mitigations.** Each mitigation must be:
   - Implementable (concrete control, not "improve security").
   - Measurable (you can verify it landed).
   - Owner-assigned (which team builds it).
6. **Residual risk.** What remains after mitigations? State it
   plainly. "Mitigated" without residual analysis hides reality.
7. **Document attacker assumptions.** What's the assumed attacker
   capability? Network adversary, malicious insider, compromised
   third-party vendor, phishing entry. Different assumptions =
   different threat surface.

## Common modeling failures

1. **No trust boundaries.** STRIDE without boundaries lists
   threats that aren't reachable.
2. **Mitigation theater.** "Add WAF" listed for every threat,
   regardless of fit. Mitigations must match the threat.
3. **Missing the supply chain.** Dependencies, build pipeline,
   container base images all carry threat. Include them.
4. **Identity gaps.** No service-to-service auth on internal
   flows; "internal network is trusted" is a 2005 mindset.
5. **Logging without alerting.** Logs without an alerting
   pipeline are forensic-only.
6. **Ignoring abuse.** Rate limits per IP fail with botnets;
   add per-account, per-action, and behavioral controls.
7. **No retest.** Threat models drift; revisit at each
   architecture change.

## Output

```
:::artifact
template: threat-modeling
component: "..."
scope: "..."
trust-boundaries: [...]
attacker-model: "external internet adversary; phishing-capable; no internal foothold"
threats:
  - id: T1
    flow: "user → API gateway → auth service"
    category: "Spoofing"
    description: "..."
    severity: "High"
    likelihood: "Medium"
    mitigation: "mTLS between gateway and auth"
    residual: "compromised gateway can still impersonate users; mitigated by short-lived tokens + revocation list"
    owner: "platform-team"
  - ...
:::
```

## Refusal

The agent will not:
- Approve a threat model that lists "Critical" threats with no
  mitigation owner or no residual-risk analysis.
- Bless an architecture that violates least privilege without
  written exception.
- Produce a threat model claimed to be exhaustive — every model
  is bounded by the modeler's imagination; surface unknowns.
