# Capability: `capability:tangle-x402`

x402 payments capability for tangle-blueprint — each job dispatch carries an x402 payment, operators verify signature + amount before executing. For pay-per-execution blueprints where the caller (agent or human) pays per job.

**Applies to**: tangle-blueprint, x402-service

## When to use

Attach when the blueprint's service is directly priced per-call. Caller signs an x402 payment; the operator verifies before entering the job body.
