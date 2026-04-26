# research-assistant

Greenfield agent-runtime bundle. Demonstrates the SF `agent-runtime`
surface end-to-end: a system prompt + domain templates + Cloudflare
Worker triggers, with no source product to extract from.

## What this bundle is

This bundle is a **filesystem the agent reads at runtime** — a system
prompt that loads templates conditionally, a Worker shell that exposes
chat + cron, and a structured-output contract.

There is no `pnpm build` step for the bundle as content. The Worker
shell builds with `wrangler deploy`; the bundle's actual *artifact* is
`system-prompt.md` + `templates/` + `wrangler.toml`.

## How a sandbox spawns it

1. Sandbox mounts the bundle directory at `/agent`.
2. Agent reads `system-prompt.md` first; the YAML frontmatter declares
   `allowedDomains` + `allowedEnv` for the sandbox to enforce.
3. On request, agent inspects `templates/index.json`, picks the entry
   matching the requested capability, and reads that template into
   context before generating.
4. Output is wrapped in `:::proposal` / `:::survey` / `:::artifact`
   blocks the host UI parses.

## Domain capabilities

- `literature-survey` — surveys prior work on a question, ≥3 cited
  sources, axis-by-axis synthesis. Methodology in
  `templates/literature-survey.md`.
- `proposal-drafting` — drafts a 5-section research proposal. First-
  draft discipline enforced by `templates/proposal-drafting.md`.

## Extension Points

- `system-prompt.md` — change the role, output blocks, or refusal
  rules. Re-run `prompt-frontmatter-valid` after edit.
- `templates/index.json` — add new capability rows. Each new row must
  point at a real `templates/*.md` file or `template-index-valid` will
  fail.
- `templates/*.md` — add new domain templates. Each must be ≥40 lines
  of substance OR include `status: stub` frontmatter (which fails the
  substance gate honestly).
