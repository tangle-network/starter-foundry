# {{projectName}}

Aptos Move package. This is the **Aptos** dialect of Move (resource-based, `aptos_framework::` imports, named addresses) — not Sui Move.

## Prerequisites

Install the Aptos CLI: https://aptos.dev/tools/aptos-cli/install-cli/

```bash
brew install aptos   # macOS
# or: curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
```

## Commands

```bash
# Compile (type-checks + builds bytecode)
aptos move compile --named-addresses {{projectName}}=default

# Run Move unit tests
aptos move test --named-addresses {{projectName}}=default

# Publish to devnet (after `aptos init --network devnet`)
aptos move publish --named-addresses {{projectName}}=default

# Call an entry function on-chain
aptos move run \
  --function-id default::{{moduleName}}::initialize \
  --named-addresses {{projectName}}=default
```

## Structure

- `Move.toml` — package manifest, pins AptosFramework rev
- `sources/{{moduleName}}.move` — the module (resources, entry funs, views)
- `tests/{{moduleName}}Tests.move` — Move unit tests with `#[test]`

## Differences from Sui Move

If you're coming from Sui, the mental model is different:

- **Ownership**: Aptos stores resources under account addresses via `move_to` / `borrow_global`. Sui uses object-centric `transfer::transfer` / `object::new`.
- **Imports**: Aptos uses `aptos_framework::account`, `aptos_framework::coin`, etc. Sui uses `sui::object`, `sui::tx_context`.
- **Init**: Aptos modules don't have a Sui-style `init` function that runs on publish. Use a `public entry fun initialize(account: &signer)` that a deployer calls once.
- **Tests**: Aptos test annotation is `#[test(account = @addr)]`. Sui is `#[test]` + manual `test_scenario` setup.
