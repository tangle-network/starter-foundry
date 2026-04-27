# multi-agent-legal-ops-ts

Curated 3-role legal-ops team — a paralegal-intake triage role, an
in-house legal-counsel reference, and an internal-audit advisor —
coordinated under one routing protocol. High-stakes domain with
baked-in disclaimers, structured hand-offs, and PII redaction at
every inter-role boundary.

## What this bundle is

A team-bundle filesystem:

```
multi-agent-legal-ops-ts/
  AGENTS.md                      # orchestrator system prompt + Coordination section — read this first
  agents.json                    # OpenCode-native subagent registry consumed by the Tangle sandbox sidecar
  README.md
  roles/
    paralegal-intake/
      AGENTS.md                  # NOT giving advice; runs intake + conflict + summary
      methodology/
        intake-checklist.md
        conflict-check.md
        fact-pattern-summary.md
    legal-counsel/
      AGENTS.md                  # not a lawyer; no privilege; jurisdiction-agnostic
      methodology/
        contract-redline.md
        nda-msa-review.md
        regulatory-research.md
    auditor/
      AGENTS.md                  # never signs off; advisory not assurance
      methodology/
        control-walkthrough.md
        deficiency-write-up.md
```

Composes:

- `agent-base:tangle` — sandbox + router primitives
- `agent-base:secure` — fail-closed defaults
- `agent-base:privacy` — PII detection / redaction (every role
  redacts before persistence)
- `agent-output:blocks` — `:::artifact`, `:::filing`, `:::escalation`,
  `:::handoff`, `:::question`, `:::pii-blocked`,
  `:::session-disclaimer`, `:::role-disclaimer`

## What makes it a team, not a pile of agents

The differentiating content is the `## Coordination` section in
`AGENTS.md`. It defines:

1. **Default routing** — every request lands at paralegal-intake first
2. **Hand-off rules** — deterministic, rule-based, with structured
   `:::handoff` packets:
   - intake → counsel for contract / NDA / MSA / regulatory questions
   - intake → auditor for SOX / SOC 2 / ISO / NIST / PCI / HIPAA
     control questions and any process-compliance work
   - counsel → auditor when contract review surfaces a material
     weakness in counterparty / client ICFR
   - auditor → counsel when audit work surfaces a legal-exposure
     question, contract dispute, or litigation hold
3. **Privilege handling** — nothing on the team is privileged;
   intake surfaces this on every session start; counsel re-asserts
   on every binding-decision touch
4. **PII flow** — `agent-base:privacy` redaction at every inter-role
   boundary; fail-closed `assertNoPII` on every egress block

## Disclaimer matrix — what every role surfaces

| Role | Always says | Never says |
|---|---|---|
| paralegal-intake | "Not a lawyer; no privilege; not gathering for filing" | "I'll have counsel call you" |
| legal-counsel | "Not a lawyer; draft for review by bar-licensed counsel; jurisdiction-agnostic" | "This is enforceable in your jurisdiction" |
| auditor | "Draft only; a credentialed CIA/CISA signs; advisory not assurance" | "This control passes" / "This is/isn't material" |

## Hard-escalation — drop the bundle, send to outside counsel

The team is the wrong tool for these matters. ANY role that detects
one of these emits `:::escalation` and stops drafting:

1. Active or threatened litigation
2. Criminal-law adjacent
3. Binding-decision moment (about to sign / settle / waive)
4. Regulated industry (healthcare-clinical, financial services,
   defense, insurance, broker-dealer, regulated utilities, cannabis,
   gambling)
5. Jurisdiction-specific question past general principles
6. Audit findings of fraud, management override, or pervasive failure
7. Filings requiring bar admission

See the `## Coordination` section in `AGENTS.md` (Hard escalations
sub-section) for the full triggers.

## How a sandbox spawns it

1. The Tangle sandbox sidecar loads `agents.json` and registers each
   subagent. The orchestrator's `AGENTS.md` is the team-level system
   prompt; it routes the first inbound message to `defaultRespondent`
   (paralegal-intake).
2. Intake's prompt (inline in `agents.json`, mirrored from
   `roles/paralegal-intake/AGENTS.md`) surfaces
   `:::session-disclaimer`, runs the intake checklist + conflict
   check + fact-pattern summary, and emits a `:::handoff` packet.
3. The host routes the handoff to the named subagent (counsel or
   auditor), which uses its own inline `prompt` + per-role
   methodology files in `roles/<role>/methodology/`.
4. Cross-role hand-offs (counsel ↔ auditor) follow the same shape;
   the host enforces that hand-off packets carry redacted PII.
5. Every egress block passes `assertNoPII` — fail-closed.

## Domain capabilities (per role)

- **paralegal-intake**: triage, conflict-check, fact-pattern-summary
- **legal-counsel**: contract-redline, nda-review, msa-review,
  regulatory-research, escalation-protocol
- **auditor**: control-walkthrough, deficiency-write-up,
  framework-citation (SOX / SOC 2 / ISO 27001 / NIST / PCI DSS /
  HIPAA), audit-committee-escalation

## Extension points

- `roles/<role>/AGENTS.md` — adjust role refusals, output blocks.
  Re-run `agents-md-valid` after edits, then regenerate
  `agents.json` so the inline `prompt` mirrors the file.
- `roles/<role>/methodology/*.md` — refine the per-capability
  method (e.g. add a SaaS-specific data-protection annex review
  under legal-counsel).
- `AGENTS.md` (`## Coordination`) — adjust the routing contract.
  Hand-off triggers are deterministic; if a real-world matter type
  doesn't fit, add a rule, do not improvise at runtime.
- `agents.json` — add a fourth role (e.g. privacy officer,
  contracts ops) with its own subagent entry (description, inline
  `prompt`, `tools`, `permission`) plus a `roles/<new>/` directory;
  the sidecar reads `agents.json` as the source of truth.

## Why composes with `agent-base:privacy`

Every role on this team handles client PII. Counsel reads inbound
contract drafts that name parties, signers, and counterparties.
Auditor reads access listings, journal entries, vendor master
records, and HR data. Intake gathers the matter narrative which
includes everything the requester knows.

The privacy layer's structured detectors (SSN, email, phone,
credit-card-with-Luhn, IPv4/v6, multi-provider API keys, contextual
DOB) plus the optional NER backend cover the surface. The
coordination protocol forces `redactPII` at every persistence
boundary and `assertNoPII` at every egress block. PII never persists
in a hand-off packet, never persists in an artifact, and never
persists in an escalation reason.
