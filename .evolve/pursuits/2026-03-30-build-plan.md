# Pursuit: Build Plan
Generation: 4
Date: 2026-03-30
Status: designing

## System Audit

### The gap
Routing is converged (103/103). Composition produces valid scaffolds (60/60 proof suite). But the context pack — what the AI agent reads to decide what to build — is generic boilerplate:

- "Starter nextjs-ts with 5 layers and partner none." — meaningless
- "Read the entrypoints first." — obvious
- No mention of the user's actual prompt
- No build roadmap connecting the scaffold to the product

The vibecoder said "Build a SaaS with Stripe billing and team management." The AI agent needs to know: create a /dashboard page, a /settings/billing page, a /settings/team page, API routes for Stripe webhooks, team invitation flow, role-based middleware. None of that is in the current output.

### What exists
- `contextHints.extensionPoints` in manifests — lists files to extend, but not HOW
- `contextHints.commands` — how to run the project
- `agentBrief` in context pack — "summary" + "firstMoves" (both generic)
- Capability config files — have `notes` arrays with guidance, but these are per-capability, not unified into a build plan

### What doesn't exist
- The user's original prompt in the context pack
- A structured build plan with concrete next steps
- Capability-specific page/route/component recommendations
- Architecture guidance based on the family + capabilities combination

## Generation 4 Design

### Thesis
**The scaffold should include a build plan that tells the AI agent exactly what to build next.** Not code — structured guidance generated from the prompt + family + capabilities. The agent opens the project and immediately knows what pages to create, what API routes to wire, and what the architecture should look like.

### Changes

#### Architectural (must ship together)

1. **Prompt passthrough into compose report** — The user's original prompt is preserved in the compose report and context pack. The AI agent knows WHAT the user asked for, not just what family was selected.
   - Risk: LOW — additive field
   - Files: compose.ts, context-pack.ts, types.ts

2. **Build plan generator** — New function `generateBuildPlan(spec, capabilities, prompt)` that produces a structured plan:
   ```json
   {
     "goal": "Build a SaaS with Stripe billing and team management",
     "architecture": ["Next.js App Router", "Server Actions", "Middleware auth"],
     "pages": ["/dashboard", "/settings/billing", "/settings/team", "/login"],
     "apiRoutes": ["/api/webhooks/stripe", "/api/team/invite"],
     "components": ["BillingCard", "TeamMemberList", "InviteForm", "RoleSelector"],
     "dataModels": ["User", "Team", "Subscription", "Invitation"],
     "integrations": ["Stripe Checkout", "Stripe Customer Portal", "Email invitations"]
   }
   ```
   - Risk: MEDIUM — new code, needs to handle all family+capability combinations
   - Files: new src/lib/build-plan.ts

3. **Enhanced agent brief** — Replace generic "Read the entrypoints first" with plan-specific first moves derived from the build plan.
   - Risk: LOW — template change in context-pack.ts
   - Files: context-pack.ts

4. **Capability-specific build hints** — Each capability manifest gets an optional `buildHints` field with concrete page/route/component suggestions that feed into the build plan.
   - Risk: LOW — additive manifest field
   - Files: types.ts, capability manifests

### Success Criteria
- Context pack includes original prompt: YES/NO (currently NO)
- Build plan present in composed output: YES/NO (currently NO)
- Agent brief references specific pages/routes: YES/NO (currently NO)
- Zero regressions: 103/103 corpus, 131/131 tests, 60/60 proof suite
