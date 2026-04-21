# esp32-app

Rust firmware for ESP32 using `esp-idf-svc` + `esp-idf-hal` on top of ESP-IDF (FreeRTOS). Bootstraps a WiFi scan, GPIO peripherals, and an HTTP server on `:8080` — ready to flash with `cargo espflash`.

## Prerequisites

The `xtensa-esp32-espidf` target is not in stock rustup. Install the esp-rs forked toolchain:

```sh
cargo install espup
espup install
# Source this in every shell before building:
. $HOME/export-esp.sh
```

Also install the flash and monitor tool:

```sh
cargo install espflash cargo-espflash
```

## Quick start

```sh
cargo build --release
cargo espflash flash --release --monitor
```

## Project layout

```
src/main.rs          # Firmware entrypoint — WiFi scan, HTTP server on :8080
Cargo.toml           # Crate manifest with esp-idf-svc + esp-idf-hal deps
rust-toolchain.toml  # Pins channel = "esp" (esp-rs forked rustc)
.cargo/config.toml   # Sets target = xtensa-esp32-espidf, linker = ldproxy
sdkconfig.defaults   # ESP-IDF Kconfig seed (stack sizes, logging, WiFi NVS)
build.rs             # embuild hook — wires ESP-IDF static libs into the link
```

## Extending

- **Station mode**: replace `Configuration::None` with `Configuration::Client(ClientConfiguration { ssid, password, … })` in `src/main.rs`.
- **Add HTTP routes**: call `server.fn_handler("/path", Method::Get, |req| { … })` after the existing route.
- **GPIO**: `peripherals.pins.gpio2` etc. — use `esp_idf_hal::gpio::PinDriver` to drive or read.

## Gotchas

- Source `$HOME/export-esp.sh` in every shell before `cargo build`. Without it rustc cannot find the xtensa target and linking fails with cryptic LLVM errors.
- `link_patches()` must be the first call in `main()`. LTO will strip the ESP-IDF init patches without it, causing a hard-fault on boot.
- First `cargo build` with `esp-idf-sys` takes 3–5 min — it builds the entire ESP-IDF C layer from source. Cache `.embuild/` between CI runs.
- Editing `sdkconfig.defaults` after the first build requires deleting `.embuild/` to force a regen (ESP-IDF snapshots Kconfig at cmake time, not on every build).
