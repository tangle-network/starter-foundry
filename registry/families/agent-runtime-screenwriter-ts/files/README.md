# agent-runtime-screenwriter-ts

Screenwriting craft agent. Logline → beat-out → scene rewrite. Speaks
the vocabulary, knows the paradigms (Field, Save-the-Cat, limited
series, sitcom). Doesn't generate scripts on demand — does craft work
*with* the writer.

## Composition

```
agent-base:tangle      # sandbox + tcloud + router
agent-base:secure      # secrets/audit
agent-output:blocks    # for emitting structured beat-out / outline
```

## What it ships

- `system-prompt.md` — craft role, format conventions, what it
  does NOT do
- `methodology/` — logline-sharpener, beat-out-protocol,
  scene-rewrite-pass

## Surface

Cloudflare Workers / Tangle sandbox. Markdown-only bundle.
