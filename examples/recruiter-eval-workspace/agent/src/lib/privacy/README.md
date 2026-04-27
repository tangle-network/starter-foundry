# `agent-base:privacy`

PII detection and redaction at intentional egress points. Bundles call `detectPII` / `redactPII` / `assertNoPII` at the boundaries they own.

## Threat model

**Defends:** output-leak (agent writes its chain-of-thought to a log; PHI lands in the observability vendor's S3 forever) and forward-leak (agent forwards to another agent / external API with more fields than the receiver legitimately needs).

**Does NOT defend:** the agent reading PHI from a webhook (the data IS the data; we filter at egress, not at ingress); network interception (TLS at the gateway); the operator deliberately disabling the filter via `allow`.

**Composability:** pure functions. No global state. Bundles pick which detectors apply per egress, which spans to allow, what redaction shape to use.

## API

```ts
import { detectPII, redactPII, assertNoPII } from '@/lib/privacy'

// Detect — returns spans; pure.
const { spans } = await detectPII(text)

// Redact — returns redacted text + spans + changed flag.
const { redacted, changed } = await redactPII(text)
if (changed) audit.log({ event: 'privacy.redacted', target: 'log-line', payload: { types: spans.map((s) => s.type) } })

// Hard fault — throws on any PII.
await assertNoPII(text)
```

## What ships in the layer (structured detectors)

- **SSN** — `xxx-xx-xxxx` with reserved-area-number rejection (000 / 666 / 9xx) — high confidence
- **Email** — RFC 5322-lite — high confidence
- **Phone** — North American + international leading-`+` formats — medium confidence
- **Credit card** — 13-19 digit groups with **Luhn validation** (drops 16-digit-but-not-card false positives) — high confidence
- **IPv4 / IPv6** — public/private discrimination (private nets at low confidence) — medium / low
- **API keys** — multi-provider patterns: `sk-` (OpenAI), `sk-ant-` (Anthropic), `sk-tan-` (Tangle), `AKIA` (AWS), `ghp_` / `ghs_` (GitHub), `xoxb-` (Slack), JWT `eyJ...`, PEM private-key blocks — high confidence
- **DOB** — date strings that appear after `DOB:` / `born` / `birthday` context anchors only (bare dates are too ambiguous) — high confidence

## What requires a backend (semantic detectors)

Person names, street addresses, account numbers — these need NER or a token classifier. The layer **does NOT ship one** because:

1. Real PII NER models are 50M+ parameters (openai/privacy-filter is 50M active / 1.5B total) — too large to bake into every bundle
2. Operators have different latency/accuracy budgets
3. License terms vary (openai/privacy-filter is Apache-2.0; Presidio is MIT; AWS Comprehend is paid)

Wire your choice via `nerBackend`:

```ts
import { redactPII } from '@/lib/privacy'

// Wrap openai/privacy-filter as a subprocess (Apache-2.0)
const nerBackend = async (text: string) => {
  const result = await spawnAndCapture(['opf', 'redact', '--json'], text)
  return parseOpfSpans(result)
}

const { redacted } = await redactPII(text, { nerBackend })
```

When the backend errors, structured detection still runs — the call doesn't propagate the failure. Operators who need a hard guarantee should run `detectPII` once and assert on the result before egress.

## Where to call these in a bundle

```ts
// Before logging the chain-of-thought to observability
audit.log({ event: 'agent.thought', target: '...', payload: { thought: (await redactPII(thought)).redacted } })

// Before forwarding to another agent
const { redacted, spans } = await redactPII(payload.notes, {
  // Doctor → analytics export: keep nothing
  redactWith: () => '[REDACTED]',
})
await webhookOut(target, { ...payload, notes: redacted }, opts)

// Before storing in `/workspace/sensitive/`
const { redacted } = await redactPII(content, {
  // Keep last-4 SSN for record reconciliation; redact everything else
  redactWith: (span) => (span.type === 'ssn' && span.subtype === undefined
    ? `***-**-${span.value.slice(-4)}`
    : `[REDACTED:${span.type}]`),
})
workspace.write(path, redacted)
```

## Field-aware policies (the non-trivial part)

The default `redactWith` keeps last-4 of SSN and credit-card. For other shapes (mask middle of phone, preserve email domain, swap a name with `[Patient]`), pass a custom `redactWith`:

```ts
const { redacted } = await redactPII(text, {
  redactWith: (span, original) => {
    switch (span.type) {
      case 'phone':
        return span.value.replace(/\d(?=\d{4})/g, '*') // *** *** 1234
      case 'email':
        return span.value.replace(/^[^@]+/, '****')   // ****@example.com
      case 'person-name':
        return '[Patient]'                              // role-based replacement
      default:
        return `[REDACTED:${span.type}]`
    }
  },
})
```

## Performance

Structured detectors are pure regex — sub-millisecond on KB-sized inputs. NER backends are the latency cost (typical 50–500ms for a model call); call `redactPII` only at egress points, not on every internal LLM message.

## Non-goals

- **Encryption at rest** — that's `agent-base:integrity` (audit chain) + dotenvx for secrets
- **Network-layer protection** — TLS at the gateway
- **Block-by-default at the gateway** — that's the platform RFC (separate doc); this layer is the bundle-level filter
- **Differential privacy** — out of scope; relevant for analytics, not per-conversation egress
