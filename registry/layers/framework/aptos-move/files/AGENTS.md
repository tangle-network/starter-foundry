# AGENTS.md — {{projectName}} (Aptos Move)

This is an **Aptos Move** package — not Sui Move. Imports use `aptos_framework::*`.

## Prerequisites

```bash
brew install aptos          # macOS
# or: curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
```

## Commands

```bash
# Type-check and compile
aptos move compile --named-addresses {{projectName}}=default

# Run Move unit tests
aptos move test --named-addresses {{projectName}}=default

# Initialize a devnet account (once)
aptos init --network devnet

# Fund the account on devnet
aptos account fund-with-faucet --account default

# Publish the module
aptos move publish --named-addresses {{projectName}}=default

# Call the initialize entry function on-chain
aptos move run \
  --function-id default::{{moduleName}}::initialize \
  --named-addresses {{projectName}}=default
```

## Structure

| Path | Purpose |
|------|---------|
| `Move.toml` | Package manifest; pins AptosFramework to `mainnet` branch |
| `sources/{{moduleName}}.move` | Main module: Counter resource, entry functions, `#[view]` |
| `tests/{{moduleName}}Tests.move` | Unit tests using `#[test]` and `#[expected_failure]` |

## Extending

1. Add new resource structs to `sources/{{moduleName}}.move`
2. Add `public entry fun` functions for transaction-callable operations
3. Add `#[view]` functions for read-only queries
4. Mirror tests in `tests/{{moduleName}}Tests.move`

## Critical rules

- Any function that reads or writes a resource must declare `acquires ResourceType`
- Guard `move_to` with `assert!(!exists<T>(addr), ...)` to prevent double-init aborts
- `signer` is non-copyable — always pass as `&signer`, never store or clone it
- Named address `{{projectName}}` resolves to `default` in CLI flags; supply the real hex address for mainnet
- Aptos events: annotate the struct with `#[event]` and emit via `event::emit(MyEvent { ... })`
- `aptos move test` runs in an in-VM harness — always do a real publish test before production
