# Arkworks prover starter

Rust primitive layer for ZK. Hand-rolled R1CS constraints, explicit curve +
proof system choice. The layer UNDERNEATH Noir / SP1 / RISC Zero — use
when those are too coarse (research, novel curves, bespoke proof systems).

## When not to use this

| Goal | Use |
|---|---|
| Prove a small-to-medium thing | [zk-noir](../../layers/capability/zk-noir) |
| Prove arbitrary Rust | [risczero-zkvm](../risczero-zkvm) or [sp1-zkvm](../sp1-zkvm) |
| Go-native prover service | [zk-gnark](../../layers/capability/zk-gnark) |
| Learn ZK for the first time | anything except arkworks |

## Layout

```
Cargo.toml                # binary crate with ark-* deps pinned to 0.5
rust-toolchain.toml       # pinned stable
src/
  main.rs                 # setup → prove → verify happy-path demo
  circuit.rs              # ConstraintSynthesizer impl — your circuit logic
  prover.rs               # Groth16 wrappers over BN254
```

## Run

```bash
cargo run --release
# Setup complete — pk/vk generated (dev only)
# Proved knowledge of (3, 4) such that sum == 7
# Verified ✓
# Rejected tampered public input ✓
```

## Constraint discipline

- **Every Var** — private via `FpVar::new_witness`, public via
  `FpVar::new_input`. Bare `Fr` values can't combine with Vars directly.
- **Every relation is an enforce_* call**. `let sum = &a + &b;` creates
  an intermediate Var but adds NO constraint. `sum.enforce_equal(&expected)?;`
  is what actually binds the prover.
- **Conditional logic** via `Boolean::select(&cond, &if_true, &if_false)`.
  No Rust pattern-matching in circuit; every branch evaluates.
- **Hashing** via `ark-crypto-primitives` (Poseidon, Pedersen) or
  `ark-sponge`.

## Trusted setup

`dev_setup` is fine for tests + local dev. For production:

1. Run a ceremony (Perpetual Powers of Tau for Groth16).
2. Serialize pk/vk via ark-serialize `CanonicalSerialize::serialize_compressed`.
3. Load at runtime from disk/IPFS. Never regenerate in production paths.

## Swap the proof system

This starter uses ark-groth16. To switch:

- **Marlin**: `cargo add ark-marlin` — universal trusted setup, no
  per-circuit ceremony.
- **Plonk**: `cargo add ark-plonk` — universal SRS, EVM-friendly.
- **Nova**: `cargo add ark-nova` — folding scheme, transparent
  (no trusted setup), unique for incrementally-verifiable computation.

Each rewires the prove/verify calls but the circuit stays the same.

## Gotchas

- **Field overflow** — BN254 scalars are ~254 bits. u64 values are always
  safe; big-int / packed bytes need explicit reduction.
- **API drift** — ark-* minor bumps (0.4 → 0.5) reliably break. Pin exact
  versions in Cargo.toml and commit Cargo.lock.
- **Forgetting enforce_equal** — circuit builds, proof generates, verifier
  accepts anything. Look for any intermediate Var that's never consumed by
  an enforce_*.
