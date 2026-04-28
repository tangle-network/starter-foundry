# Family: `agent-swarm-ts`

Multi-agent swarm family — supervisor/worker orchestration with shared state, tool-routing, and handoff protocols. Based on LangGraph state machines or CrewAI role-based crews. For products where one LLM call isn't enough: research assistants that delegate to search/code/analysis sub-agents, customer support with triage + specialist agents, document pipelines with extract/analyze/summarize roles.

**Taxonomy**: language=typescript · runtime=node · surface=api

**Tags**: agent, multi-agent, swarm, langgraph, crewai, supervisor, typescript

## When to use

Multi-agent orchestration with supervisor/worker handoffs. Use when ONE LLM call isn't enough — research agents that delegate to search/analyze/summarize roles, triage+specialist support, document pipelines. For a single agent with tool use, use `agent-service-ts` instead.

## First moves

- Set the router API key: `export OPENAI_API_KEY=$TANGLE_API_KEY` — agents call via router.tangle.tools, NOT OpenAI directly.
- Add a new specialist: create `src/agents/<name>.ts` exporting a `run<Name>(state)` function. Register it in supervisor.ts's node graph.
- Extend `SwarmState` in src/state.ts when adding fields the new agent reads/writes. Use the Annotation<T>({ reducer }) pattern — reducers determine how updates merge.
- The supervisor is rule-based (src/supervisor.ts). Swap to an LLM-driven supervisor by replacing `supervise()` with an LLM call if the routing is non-obvious.
- Test end-to-end: `curl -X POST http://localhost:{{port}}/run -d '{"task": "your task"}'` — kicks off researcher → writer.

## Gotchas

- LangGraph's Annotation reducers fire on EVERY state update. Accidentally returning {messages: state.messages} duplicates history. Return only the FIELDS you're changing.
- The `END` marker terminates the graph. The supervisor must set `nextAgent: "END"` when work is done — otherwise the graph loops forever.
- ChatOpenAI needs `configuration.baseURL` set to router.tangle.tools — without it calls go to api.openai.com and fail/cost unexpectedly.
- Shared state = tight coupling. If a new agent needs a field that no other agent reads, DON'T put it in SwarmState — use private module-scope instead.

## Placeholders (agent MUST replace)

- `src/agents/researcher.ts` — Placeholder researcher agent returning generic bullet notes. Replace system prompt + tool surface for the product's actual research domain.
- `src/agents/writer.ts` — Placeholder writer converting notes to prose. Replace system prompt for the product's target voice/format.
- `src/supervisor.ts` — Rule-based supervisor (has-notes? → writer; else → researcher). Replace with product-specific routing or an LLM-driven supervisor for non-linear flows.

## Slots

- `database` — options: database:sqlite, database:postgres, database:mongodb, database:convex (default: `database:postgres`)
- `auth` — options: auth:none, auth:better-auth, auth:clerk (default: `auth:none`)

## Routing keywords

- **tier1**: multi-agent, multi agent, agent swarm, langgraph-js, langgraphjs, typescript multi-agent
- **tier2**: supervisor agent, agent handoff, specialist agents, agent team
- **archetypes**: research assistant with sub-agents, triage and specialist support, document pipeline agents, planner and executor agents
