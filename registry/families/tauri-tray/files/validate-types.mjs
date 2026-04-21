import fs from "node:fs/promises";

JSON.parse(await fs.readFile("tsconfig.json", "utf8"));

const tauriConf = JSON.parse(await fs.readFile("src-tauri/tauri.conf.json", "utf8"));
const windows = tauriConf.app?.windows ?? [];
// Tray daemons have NO visible primary window. Either zero windows, or
// one hidden window used for lazy settings UI.
const anyVisible = windows.some((w) => w.visible !== false);
if (anyVisible) {
  throw new Error("tauri-tray must not declare visible:true windows — tray daemons are windowless by default");
}

const cargoToml = await fs.readFile("src-tauri/Cargo.toml", "utf8");
if (!cargoToml.includes("[package]")) {
  throw new Error("missing tauri Cargo package block");
}
if (!cargoToml.includes("tauri-plugin-notification")) {
  throw new Error("tauri-tray expects tauri-plugin-notification — tray daemons speak to users through OS notifications");
}

const libRs = await fs.readFile("src-tauri/src/lib.rs", "utf8");
if (!libRs.includes("TrayIconBuilder") || !libRs.includes("Menu")) {
  throw new Error("src-tauri/src/lib.rs must build a TrayIcon with a Menu");
}

console.log("tauri tray ok");
