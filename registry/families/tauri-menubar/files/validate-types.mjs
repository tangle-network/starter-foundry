import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const appSource = await fs.readFile("src/App.tsx", "utf8");
stripTypeScriptTypes(appSource);

const mainSource = await fs.readFile("src/main.tsx", "utf8");
stripTypeScriptTypes(mainSource);

JSON.parse(await fs.readFile("tsconfig.json", "utf8"));

const tauriConf = JSON.parse(await fs.readFile("src-tauri/tauri.conf.json", "utf8"));
const win = tauriConf.app?.windows?.[0];
if (!win || win.decorations !== false || win.alwaysOnTop !== true || win.skipTaskbar !== true) {
  throw new Error("tauri.conf.json window is not configured as a popover panel (decorations:false, alwaysOnTop:true, skipTaskbar:true)");
}

const cargoToml = await fs.readFile("src-tauri/Cargo.toml", "utf8");
if (!cargoToml.includes("[package]")) {
  throw new Error("missing tauri Cargo package block");
}
if (!cargoToml.includes("tauri-plugin-positioner") && !cargoToml.includes("tray")) {
  throw new Error("tauri-menubar expects a tray/positioner dep so the popover anchors to the menu-bar icon");
}

const libRs = await fs.readFile("src-tauri/src/lib.rs", "utf8");
if (!libRs.includes("TrayIconBuilder")) {
  throw new Error("src-tauri/src/lib.rs must build a TrayIcon for the menu-bar surface");
}

console.log("tauri menubar ok");
