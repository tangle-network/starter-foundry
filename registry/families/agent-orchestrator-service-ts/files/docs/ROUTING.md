# Routing

How `/chat` decides which role handles a turn.

## Decision order

`src/lib/router.ts:decideRoute` runs this cascade for every `/chat` call:

1. **Single-agent pack** → trivially the only role. Returns immediately,
   no LLM call. `decision.reason === 'single-agent'`.

2. **Caller-supplied `roleId` override** → if the caller set
   `roleId: "engineering"` in the `/chat` body and that role exists on
   the team, it wins. Useful for "reply in this thread, always as
   role X" patterns. `decision.reason === 'team-default-respondent'`.

3. **Team's `defaultRespondent`** → if `agent-roster.json` declares a
   default, that role wins for every turn. Use when routing is
   deterministic (a Slack bot that always replies as the persona). No
   LLM call. `decision.reason === 'team-default-respondent'`.

4. **LLM routing** → cheap routing model picks one of the team's roles
   based on the latest user message. `decision.reason === 'team-llm-routed'`.

## LLM routing details

The routing prompt is built from the role list:

```
You are a routing dispatcher inside a multi-agent team. Your job is to
pick the single role best suited to handle the latest user message.

Available roles:
  - frontline — Tier 1 triage and account questions
  - engineering — Deep debugging, performance, infra

Rules:
  1. Reply with ONLY the role id. No prose, no punctuation, no quotes.
  2. The role id MUST be one of the ids listed above, exactly.
  3. If the message could be handled by any role, pick the most specific match.
```

The user turn is the last user message from the `/chat` request. The
model is whatever `ROUTING_MODEL` env var sets (defaults to a Haiku-class
cheap model).

If the LLM returns garbage (an unknown role id, prose, etc.), the router
falls back to `roles[0]` and `decision.reason` is still `'team-llm-routed'`
— the audit log will show the misroute via the fact that
`decision.roleId !== <whatever the LLM said>`.

## Cost & latency model

| Path                          | Extra LLM calls | Latency penalty |
| ----------------------------- | --------------- | --------------- |
| single-agent                  | 0               | 0               |
| team + defaultRespondent      | 0               | 0               |
| team + roleId override        | 0               | 0               |
| team + LLM routing            | 1 (cheap model) | ~150–400 ms     |

If your team rarely needs role disambiguation, set `defaultRespondent`
and let the consumer pass an explicit `roleId` for the rare detour.
You'll save the routing call on every turn.

## Custom routing

The current router is pure heuristic + a single LLM call. If you want
something more sophisticated:

- Replace `decideRoute` with a custom function (graph-based routing,
  tool-call-driven routing, embedding-similarity routing, etc.).
- Keep the `RouterDecision` return shape — `chat.ts` and the audit log
  depend on the `pack`, `roleId`, `reason` triple.

## Tests

`test/router.test.ts` covers all paths plus the parser invariants
(missing pack, duplicate role ids, dangling default-respondent). Run
`pnpm test`.
