# Toolchain requirements

This blueprint pins **rustc 1.91+** via `rust-toolchain.toml` (blueprint-sdk
0.2.0-alpha.2 and later require it).

If your system rustc is older, install 1.91 before running `cargo build`:

```bash
rustup install 1.91
# From the project root, rustup auto-selects 1.91 due to rust-toolchain.toml
cargo build --workspace
```

Common rustup setups auto-install the pinned toolchain on the first
`cargo` invocation — no manual step needed. If your CI skips rustup
provisioning, ensure the runner has 1.91 available.
