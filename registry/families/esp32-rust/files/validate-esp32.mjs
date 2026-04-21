// Structural validator for the esp32-rust starter. Does NOT run cargo
// (xtensa toolchain isn't available during scaffold validation). Asserts
// the file tree + critical strings so a downstream `cargo build --release`
// has the preconditions it needs.

import fs from "node:fs/promises";

const [cargoToml, cargoConfig, toolchain, sdkconfig, mainRs] = await Promise.all([
  fs.readFile("Cargo.toml", "utf8"),
  fs.readFile(".cargo/config.toml", "utf8"),
  fs.readFile("rust-toolchain.toml", "utf8"),
  fs.readFile("sdkconfig.defaults", "utf8"),
  fs.readFile("src/main.rs", "utf8"),
]);

if (!cargoToml.includes("esp-idf-svc")) {
  throw new Error("Cargo.toml must depend on esp-idf-svc");
}
if (!cargoToml.includes("esp-idf-hal")) {
  throw new Error("Cargo.toml must depend on esp-idf-hal");
}
if (!cargoToml.includes("esp-idf-sys")) {
  throw new Error("Cargo.toml must depend on esp-idf-sys");
}
if (!cargoToml.includes("[package.metadata.esp-idf-sys]")) {
  throw new Error("Cargo.toml must pin esp_idf_version under [package.metadata.esp-idf-sys]");
}

if (!cargoConfig.includes("xtensa-esp32-espidf")) {
  throw new Error(".cargo/config.toml must set target = \"xtensa-esp32-espidf\"");
}
if (!cargoConfig.includes("ldproxy")) {
  throw new Error(".cargo/config.toml must set linker = \"ldproxy\"");
}

if (!toolchain.includes('channel = "esp"')) {
  throw new Error('rust-toolchain.toml must pin channel = "esp" (esp-rs forked rustc)');
}

if (!sdkconfig.includes("CONFIG_ESP_MAIN_TASK_STACK_SIZE")) {
  throw new Error("sdkconfig.defaults must bump CONFIG_ESP_MAIN_TASK_STACK_SIZE (WiFi+HTTP overflows the 3584B default)");
}

if (!mainRs.includes("esp_idf_svc::sys::link_patches")) {
  throw new Error("src/main.rs must call esp_idf_svc::sys::link_patches() — without it the linker drops the ESP-IDF init patches");
}
if (!mainRs.includes("EspHttpServer")) {
  throw new Error("src/main.rs must instantiate EspHttpServer on :8080 per the spec");
}
if (!mainRs.includes("WifiDriver") && !mainRs.includes("EspWifi")) {
  throw new Error("src/main.rs must set up a WiFi driver (scan or station mode)");
}

console.log("esp32-rust starter ok");
