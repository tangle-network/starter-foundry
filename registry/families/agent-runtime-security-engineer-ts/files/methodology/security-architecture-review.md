# Security Architecture Review Template

## Overview
Evaluate the security posture of a system architecture against the
core security principles, common attack patterns, and the operator's
threat model. Output is a findings doc with prioritized
recommendations — not a checklist tick.

## When to use
Trigger when the user is reviewing a new system design, an existing
system pre-launch, or a change that touches identity / data / trust
boundaries. For specific vulnerability triage, use
vulnerability-triage.md. For per-component STRIDE, use
threat-modeling.md.

## Method

1. **Understand the architecture.** Read or request:
   - Architecture diagram with components, data flows, and trust
     boundaries.
   - Identity model (who calls what, with what credentials).
   - Data classification (what's sensitive, where it lives, how
     it's encrypted).
   - Operational model (deploys, on-call, incident response).
   - Threat model if one exists.
2. **Inventory existing controls.**
   - **Identity**: authentication (user, service-to-service),
     authorization (RBAC, ABAC, ACLs), federation.
   - **Data protection**: encryption at rest, in transit, key
     management, key rotation.
   - **Network**: segmentation, VPCs, security groups, WAF, DDoS
     protection, mTLS internal.
   - **Logging & monitoring**: what's logged, how long, alerting
     on what, anomaly detection.
   - **Secrets management**: how secrets are stored, rotated,
     accessed; least-priv on secret access.
   - **Supply chain**: dependency management, build integrity,
     SBOM, container provenance.
3. **Apply the principles.** For each principle, ask "where does
   this system honor it, and where does it not?":
   - **Least privilege**: every identity has the minimum perms
     required. Audit IAM, sudo, service roles.
   - **Defense in depth**: multiple controls; the failure of any
     one doesn't expose the asset.
   - **Secure defaults**: the system is safe out of the box; the
     unsafe option requires explicit opt-in.
   - **Fail-safe defaults**: failures default to deny / closed
     state, not open.
   - **Separation of duties**: critical actions require multiple
     parties (production deploys, key access, incident response
     escalation).
   - **Complete mediation**: every access is checked; no cached
     "trust" bypasses.
   - **Open design**: security doesn't depend on obscurity of the
     mechanism (Kerckhoffs).
   - **Least common mechanism**: minimize shared infrastructure
     across trust boundaries.
   - **Psychological acceptability**: secure path is easy; if it's
     painful, users route around it.
4. **Map to common attack patterns.**
   - **OWASP Top 10** (web): injection, broken auth, sensitive
     data exposure, XXE, broken access control, security
     misconfiguration, XSS, insecure deserialization, components
     with known vulns, insufficient logging.
   - **MITRE ATT&CK** (intrusion): initial access, execution,
     persistence, privilege escalation, lateral movement,
     credential access, exfiltration, impact.
   - **Cloud-native** (CNCF / CSA): metadata-service abuse,
     IAM mis-config, lateral movement via shared accounts,
     tenant isolation gaps.
5. **Highlight strengths.** Don't only list weaknesses; the doc
   reads as adversarial without context. Note where the
   architecture does the right thing.
6. **Rank weaknesses.** Each finding gets:
   - Severity (Critical / High / Medium / Low / Observation).
   - Reachability (currently exploitable / requires prior
     compromise / theoretical).
   - Recommendation (specific, owned, dated).
7. **Operational concerns.** Many breaches happen through
   operational gaps, not architecture flaws:
   - Patch management cadence, vulnerability scanning, MFA on
     admin accounts, backup integrity, incident-response
     playbooks tested.
8. **Compliance overlay.** SOC 2, ISO 27001, HIPAA, GDPR, PCI
   DSS — note where the architecture meets and where gaps exist.

## Output

```
:::artifact
template: security-architecture-review
system: "..."
diagrams-reviewed: ["..."]
controls:
  identity: { authn: ..., authz: ..., notes: "..." }
  data: { ... }
  network: { ... }
  logging: { ... }
  secrets: { ... }
  supply-chain: { ... }
strengths:
  - "mTLS between all internal services"
  - "..."
weaknesses:
  - id: F1
    description: "Admin API is on the same network segment as user-facing API"
    severity: "High"
    reachability: "Requires prior auth as user; lateral movement"
    recommendation: "Separate admin API into its own VPC; require IP allow-list"
    owner: "platform-team"
    target: "2026-Q3"
  - ...
risk-level: "Medium"
compliance-status: { soc2: "compliant", gdpr: "gap on data-residency control" }
:::
```

## Common review failures

1. **Checkbox security.** Walking the principles without
   evidence is theater.
2. **Architecture-only blindness.** Operational gaps (no MFA on
   admins) often dwarf architectural risk.
3. **No prioritization.** A flat list of 50 findings without
   priority drowns the team.
4. **Fixation on perimeter.** Internal trust assumptions are
   often the weak point post-perimeter-breach.
5. **Ignoring supply chain.** Build pipeline and dependency
   risk are first-class threats.

## Refusal

- The agent will not sign off on a review with Critical
  findings unaddressed and no plan.
- The agent will not bless an architecture relying on security
  through obscurity.
- The agent will not produce a review without an explicit threat
  model — review without threats is a vibe check.
