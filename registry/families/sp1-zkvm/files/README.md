# Succinct SP1 zkVM starter

Modern general-purpose Rust zkVM. Prove arbitrary Rust; verify locally,
on the Succinct prover network, or on-chain via Gnark/Plonk.

## Layout

```
Cargo.toml               # workspace root — script is a member; program is excluded (separate build)
rust-toolchain.toml      # pinned stable
program/
  Cargo.toml             # sp1-zkvm dep
  src/main.rs            # runs INSIDE the SP1 zkVM (RISC-V target)
script/
  Cargo.toml             # sp1-sdk + sp1-build
  src/main.rs            # entry point
  src/prover.rs          # ProverClient + SP1Stdin wiring
```

## Run

```bash
# Install the SP1 toolchain (one-time).
curl -L https://sp1.succinct.xyz | bash
sp1up

# Build the program (generates program/elf/riscv32im-succinct-zkvm-elf).
cd program && cargo prove build && cd ..

# Prove + verify.
#   Fast dev: SP1_PROVER=mock cargo run --release -p script
#   Local real: SP1_PROVER=cpu cargo run --release -p script
#   Cloud: SP1_PROVER=network SP1_PRIVATE_KEY=<network-key> cargo run --release -p script
cargo run --release -p script
```

## Proof variants

| Variant | How | Use case |
|---|---|---|
| compressed STARK | `.prove().run()` | off-chain verification, smallest & fastest |
| Plonk (Gnark) | `.prove().plonk().run()` | on-chain EVM via `SP1Verifier.sol`, ~5 KB proof |
| Groth16 | `.prove().groth16().run()` | on-chain, ~200 byte proof, slower prove |

Pick plonk/groth16 only when you need on-chain verification. Compressed is
cheaper everywhere else.

## On-chain verification

Succinct ships `SP1Verifier.sol` + a trusted setup per proof variant:

```solidity
// In your Solidity consumer:
ISP1Verifier(verifier).verifyProof(vkey, publicValues, proofBytes) returns (bool)
```

See `github.com/succinctlabs/sp1-contracts` for the verifier + a rollup
example.

## Gotchas

- **RISC-V constraints**: no net, no fs, no system clock. Pure compute.
- **Public values order matters**: program commits in order → verifier reads
  in same order. Mismatching the order silently decodes garbage.
- **include_elf! requires sp1-build in `[build-dependencies]`**; without it
  you get a compile error on the ELF constant.
- **SP1_PRIVATE_KEY is a prover-network credential**, not an Ethereum key.
  Get it from the Succinct dashboard; belongs in secret storage.
