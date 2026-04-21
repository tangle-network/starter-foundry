# Capability: `capability:tangle-remote-provider`

Remote provider blueprint capability — the blueprint calls out to external services (LLM providers, RPC endpoints, SaaS APIs) with credential injection + rate-limit handling. Apply when the operator's job is effectively a thin wrapper around a third-party API.

**Applies to**: tangle-blueprint

## When to use

Attach when the job's body is a single outbound HTTP request. Operators inject their own credentials and rate-limit state; Tangle handles scheduling + billing.

## First moves

- Declare the endpoint + method in remote-config.json
- Secrets pulled from the operator's keystore at dispatch (never in the blueprint source)
- Wrap the call in a retry/backoff helper — network errors are the dominant failure mode
