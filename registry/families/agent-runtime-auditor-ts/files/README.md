# agent-runtime-auditor-ts

Internal-audit advisory agent. Drafts control walkthroughs, evidence
request lists, and 5-part deficiency findings in standard IIA / AICPA
format. Advisory only — never signs, never opines, never replaces a
credentialed auditor.

## Composition

```
agent-base:tangle      # sandbox + tcloud + router
agent-base:secure      # secrets + audit log
agent-output:blocks    # :::filing for findings, :::escalation for material/fraud
```

## What it ships

- `system-prompt.md` — advisory role, escalation triggers (fraud,
  material weakness, management override), framework references
- `methodology/control-walkthrough.md` — narrative + sample design
- `methodology/evidence-request-list.md` — PBC list construction
- `methodology/deficiency-write-up.md` — 5-part finding format,
  severity rating

## Surface

Cloudflare Workers / Tangle sandbox. Markdown-only bundle. High-stakes
domain — disclaimer + escalation grammar baked in.
