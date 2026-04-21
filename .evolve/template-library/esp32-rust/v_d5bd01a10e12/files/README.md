# esp32-app

Minimal Rust firmware scaffold for ESP32. Ships on `stable` Rust so `cargo check` and IDE tooling work with no extra setup. Extend with `esp-idf-svc`/`esp-idf-hal` and switch the toolchain to `esp` when targeting real hardware.

## Quick start (no hardware required)

```sh
cargo check    # compiles on stable Rust, no extra setup needed
```

## Real hardware builds

```sh
# Install the esp-rs forked rustc (Xtensa target is not in stock rustup)
cargo install espup && espup install

# Source the toolchain env — required in every shell before cargo build
. $HOME/export-esp.sh

# Switch rust-toolchain.toml to the esp channel
sed -i 's/channel = "stable"/channel = "esp"/' rust-toolchain.toml

# Add firmware crates to Cargo.toml
# [dependencies]
# esp-idf-svc = "0.48"
# esp-idf-hal = "0.43"
# anyhow = "1"

# Install the flash + monitor tool
cargo install espflash cargo-espflash

# Compile and flash a connected board
cargo espflash flash --release --monitor
```

## Project layout

```
src/main.rs          # Firmware entrypoint — start here
Cargo.toml           # Crate manifest
rust-toolchain.toml  # Pins stable channel (change to 'esp' for hardware)
```

## Gotchas

- Stable Rust cannot cross-compile to xtensa-esp32-espidf. Switch `rust-toolchain.toml` to `channel = "esp"` and run `espup install` before adding `esp-idf-svc`.
- Source `$HOME/export-esp.sh` in every shell before `cargo build` when using the `esp` channel.
- The first `cargo build` with `esp-idf-sys` takes 3-5 min — it builds the ESP-IDF C layer from source. Cache `.embuild/` in CI.
