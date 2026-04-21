use anyhow::Result;
use log::info;

// ESP-IDF firmware entrypoint — compile for hardware with the esp-rs toolchain:
//   cargo install espup && espup install && . $HOME/export-esp.sh
//
// On-device boot sequence:
//   1. esp_idf_svc::sys::link_patches() — must be the very first call; LTO will
//      strip ESP-IDF init patches without it, causing a hard-fault on boot.
//   2. EspWifi / BlockingWifi — radio bring-up; scan or configure station mode.
//   3. EspHttpServer on :8080 — register fn_handler routes after wifi start.

fn main() -> Result<()> {
    info!("esp32-app: run `espup install` then `cargo build --release` for hardware");
    Ok(())
}
