import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const webSource = await fs.readFile("web/app.ts", "utf8");
stripTypeScriptTypes(webSource);
JSON.parse(await fs.readFile("tsconfig.json", "utf8"));
JSON.parse(await fs.readFile("src-tauri/tauri.conf.json", "utf8"));
const cargoToml = await fs.readFile("src-tauri/Cargo.toml", "utf8");
if (!cargoToml.includes("[package]")) {
  throw new Error("missing tauri Cargo package block");
}
console.log("tauri starter ok");
