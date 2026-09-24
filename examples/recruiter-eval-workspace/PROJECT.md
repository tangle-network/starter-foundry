# recruiter-eval-workspace

## Mission
Build on top of this prepared workspace.

## Launch Plan
- Primary project: `app`
- Primary artifact: `preview` at `/`
- Target time to first artifact: 3000ms

## Projects
- `app` -> `agent-with-ui-ts` (ui-adapter:blocks-renderer)
- `agent` -> `agent-runtime-recruiter-ts` (agent-base:tangle, agent-base:secure, agent-base:privacy, agent-output:blocks, agent-base:memory, agent-base:scheduler, agent-base:mcp-registry, agent-channels:telegram, agent-channels:discord, agent-channels:slack, agent-channels:whatsapp, agent-channels:imessage, agent-channels:gmail, agent-channels:linear)
- `eval` -> `agent-eval-harness-ts` (agent-eval:scenarios, agent-base:tangle, agent-base:secure, agent-eval:judge-rubric, agent-eval:regression)

## Agent Goal
Run `pnpm dev` from the workspace root, then read each bundle's AGENTS.md before editing.

## Notes
- Extend the prepared base instead of rebuilding from zero.
- Use the root launch plan and workspace context before exploring deeply.
