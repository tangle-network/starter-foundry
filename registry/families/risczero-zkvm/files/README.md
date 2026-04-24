# RISC Zero zkVM starter

General-purpose Rust zkVM. Prove arbitrary Rust programs; optionally
delegate to the Bonsai proving network for fast cloud proofs.

## Layout

```
Cargo.toml                 # workspace root, resolver="2", members = [host, methods]
rust-toolchain.toml        # pinned stable
host/
  Cargo.toml               # std Rust — runs prover + verifier
  src/main.rs              # entry point
  src/prover.rs            # prove() / verify() wrappers
methods/
  Cargo.toml               # build-dep: risc0-build
  build.rs                 # embeds compiled guest into methods crate
  src/lib.rs               # auto-generated GUEST_ELF + GUEST_ID exports
  guest/
    Cargo.toml             # guest is NOT a workspace member
    src/main.rs            # runs IN the zkVM — pure compute
```

## Run

```bash
# First install the risc0 toolchain (one-time).
curl -L https://risczero.com/install | bash
rzup install

# Build + prove + verify locally (slow — minutes).
cargo run --release

# For fast cloud proofs, set Bonsai env vars:
export BONSAI_API_URL=https://api.bonsai.xyz/
export BONSAI_API_KEY=<your key>
cargo run --release
```

## Replacing the example circuit

1. Edit `methods/guest/src/main.rs` — change `Input`/`Output` and replace
   the addition logic with what you want proven.
2. Mirror the struct changes in `host/src/prover.rs` so the host can
   serialize/deserialize inputs and outputs.
3. Rebuild: `cargo run --release` — the risc0-build build.rs
   auto-recompiles the guest when it changes.

## On-chain verification

For EVM: use RISC Zero's Groth16 verifier + wrap the STARK receipt.
See [risc0-ethereum](https://github.com/risc0/risc0-ethereum) for the
Solidity verifier + R0 Steel examples of reading Ethereum state inside
a proof.

## Gotchas

- **Guest std is constrained** — no net, no fs, no SystemTime, limited
  float. If your compute needs those, you're using the wrong zkVM (or
  you need to pre-compute outside and pass results in via `env::read`).
- **Proof sizes are hundreds of KB**. Never bundle into a JSON response.
  Store the receipt in S3/IPFS, pass a reference.
- **BONSAI_API_KEY is a prover credential**. Belongs in secret storage,
  not source control.
- **Image ID changes on every guest recompile**. Don't hardcode — always
  use `methods::GUEST_ID` so verify stays in sync.
