# Shared Dependencies

Cross-project contracts. All projects in this workspace must agree on these.

## Projects

### app (`app`)
- Family: `agent-with-ui-ts`
- Entrypoints: `src/App.tsx`
- Commands: `pnpm dev`, `pnpm build`

### agent (`agent`)
- Family: `agent-runtime-recruiter-ts`
- Entrypoints: `AGENTS.md`, `src/lib/tangle.ts`

### eval (`eval`)
- Family: `agent-eval-harness-ts`
- Entrypoints: `src/eval/runner.ts`, `src/eval/cli.ts`, `src/lib/tangle.ts`
- Commands: `pnpm install`, `pnpm eval`, `pnpm eval:compare`, `pnpm typecheck`, `pnpm eval:gate baseline.json head.json`

## Shared Contracts

- All API projects expose `/health` for readiness checks.
- Frontend projects consume APIs via the paths defined in each API project.
- Environment variables are project-scoped. Do not assume cross-project env access.
- Data models shared between projects should be defined in the primary project and imported by others.

## Communication

- Primary project: `app`
- Primary artifact: `preview` at `/`
- Build the primary project first. Other projects support it.
