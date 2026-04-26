# legal-counsel

In-house-counsel reference agent. **Not a lawyer.** No attorney-client
privilege. Drafts redlines, runs review checklists (NDA, MSA), flags
asymmetric provisions, escalates to licensed attorneys for any
binding decision, jurisdiction-specific question, regulated-industry
contract, or litigation posture.

## What this bundle is

An agent's filesystem: a system prompt + redline / NDA / MSA review
templates + Cloudflare Worker shell + Tangle Sandbox SDK. Runs in a
per-user Tangle sandbox; LLM calls go through `router.tangle.tools`.

## Legal positioning

- **Not a lawyer.** This agent is a drafting helper and reference
  reviewer. It does not render legal advice.
- **No attorney-client privilege.** The user's words in this
  conversation are not protected. The agent reminds the user of this
  whenever they share facts that would matter in litigation.
- **Jurisdiction-agnostic.** Default analysis is general principles
  with a US lean. State UCC variations, choice-of-law enforceability
  in the operative venue, non-US contract law, and state employment /
  consumer-protection statutes (e.g. CCPA / Cal AB-1184) are out of
  scope and trigger escalation.
- **Drafting helper only.** The bundle does not sign, counter-sign,
  or "approve" contracts. Final review for any binding execution is
  the responsibility of bar-licensed outside counsel.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` for sandbox enforcement).
3. The agent opens by stating the not-a-lawyer / no-privilege limit.
4. On a contract-review request, the agent loads
   `templates/contract-redline-protocol.md` (or the NDA / MSA
   checklist for those specific types) before drafting.
5. Any binding-decision moment, regulated-industry signal, or
   jurisdiction-specific question triggers an `:::escalation` block
   handing off to licensed counsel.

## Domain capabilities

- `contract-redline` — clause-by-category review (commercials, IP,
  indemnity, LoL, term / termination, dispute resolution,
  boilerplate); flags asymmetric provisions with proposed redlines
  and market-position rationale. Methodology in
  `templates/contract-redline-protocol.md`.
- `nda-review` — NDA-specific checklist: definition of confidential
  information, exclusions, term, return-of-info, residuals, equitable
  remedies, governing law, mutual vs unilateral framing.
  Methodology in `templates/nda-checklist.md`.
- `msa-review` — MSA-specific checklist: scope / SOW structure,
  payment terms, IP assignment vs license, indemnification triggers,
  limitation-of-liability caps + carve-outs, warranties, termination
  for convenience, governing law / venue. Methodology in
  `templates/msa-checklist.md`.
- `escalation-protocol` — mandatory `:::escalation` handoff for
  binding decisions, litigation posture, regulated industries,
  criminal-law touchpoints, and jurisdiction-specific questions.

## Extension Points

- `system-prompt.md` — adjust the role / refusal rules / output
  blocks. Re-run `prompt-frontmatter-valid` after edits.
- `templates/contract-redline-protocol.md` — refine the redlining
  method (e.g. add SaaS-specific data-protection annex review).
- `templates/nda-checklist.md` and `templates/msa-checklist.md` —
  swap in firm-house-style positions, market terms by deal size.
- `defaults.allowedDomains` — additional outbound URLs the bundle is
  permitted to reach (e.g. add `sec.gov` for public-filing review,
  `uspto.gov` for IP-clause work). Anything outside this list is
  sandbox-blocked.
- `src/lib/tools/` — add domain-specific tools (clause-extraction,
  diff rendering, version comparison) without changing the prompt.
