# Aztec Noir

Rust-syntax DSL for writing ZK circuits. Compiles to ACIR (the Aztec
circuit IR); Barretenberg executes ACIR and produces UltraHonk / Groth16 /
Plonk proofs. Best-of-class developer ergonomics for small-to-medium
circuits.

## Workspace shape

```
circuits/
  Nargo.toml       # package metadata, compiler_version pin
  src/main.nr      # circuit logic — pub inputs + private inputs
  target/          # (gitignored) nargo-generated ACIR + proving keys
src/lib/
  noir-prover.ts   # TS wrapper: Noir + BarretenbergBackend
```

## Setup

```bash
# Install nargo (the Noir compiler + test runner)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup
# Compile
cd circuits && nargo compile
# Run in-circuit tests (#[test] and #[test(should_fail)] blocks)
nargo test
```

The compile step writes `circuits/target/circuit.json`. TypeScript imports
it as an ACIR JSON artifact and passes to `@noir-lang/noir_js`.

## Key language constraints

- **All values are Field elements** — mod BN254 prime (~2^254). Not ints.
  Use `as u64` / `as i64` for integer typing sugar, but arithmetic is field.
- **Loops must have known bounds**: `for i in 0..10 { ... }` — the `..10`
  must be compile-time constant. For dynamic lengths, pass a max size and
  loop to it with an active-count guard.
- **No recursion, no heap**: all memory is stack. Arrays are fixed-size.
- **`pub` marks public inputs** — private inputs are implicit. Only publics
  appear in the proof's public-inputs vector.

## Proof backends

| Backend | When to use |
|---|---|
| UltraHonk (default) | Fastest modern proving, off-chain verification |
| Groth16 | On-chain verification with tight proof size (~200 bytes) |
| Plonk | Universal trusted setup, on-chain via Solidity verifier |

Select via `backend.generateProof(witness, { backend: 'honk' \| 'plonk' \| 'groth16' })`
(API shape depends on @noir-lang/backend-* version).

## Common patterns

- **Merkle inclusion proofs**: loop `for i in 0..DEPTH` hashing sibling up
  to root; constrain `root == expected_root`.
- **Signature verification**: Noir stdlib has `std::ecdsa_secp256k1::verify_signature`.
- **Poseidon hashing**: `use dep::std::hash::poseidon;`
- **Anonymous credentials**: prove knowledge of a secret that hashes to a
  public commitment, without revealing the secret.

## Gotchas

- **Version pinning**: the @noir-lang/noir_js npm version must match the
  nargo compiler version. Mismatch produces "unknown opcode" at runtime.
- **WASM first-load**: Barretenberg ships as ~3-5MB WASM. Lazy-load behind
  a user action; don't block page-mount.
- **Proof size**: UltraHonk is kilobytes, not the compact hundreds-of-bytes
  you'd get from Groth16. For on-chain, switch backends.
