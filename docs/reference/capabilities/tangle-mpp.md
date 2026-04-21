# Capability: `capability:tangle-mpp`

MPP (Machine Payments Protocol) capability for tangle-blueprint — agent-to-agent payment rails with delegation, budget caps, and spend attestations. For blueprints that autonomous agents call on each other's behalf, enabling agent economies.

**Applies to**: tangle-blueprint, x402-service, agent-service-ts, agent-service-py, agent-service-rust, agent-swarm-ts

## When to use

Attach when blueprints or agents pay OTHER agents. MPP adds delegation (agent A authorizes agent B to spend up to $X), budget caps, and spend attestations so the caller can prove what was spent on their behalf.

## First moves

- Configure the budget cap schedule in mpp-config.json
- Delegation tokens are minted at delegate-time (signed by the principal)
- Each call burns a portion of the budget; the attestation is returned in the response
