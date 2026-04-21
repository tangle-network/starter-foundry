import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const files = [
  "src/main/index.ts",
  "src/main/menu.ts",
  "src/main/protocol.ts",
  "src/main/deeplinks.ts",
  "src/main/updater.ts",
  "src/preload/index.ts",
  "src/renderer/App.tsx",
  "src/renderer/main.tsx",
];

for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  stripTypeScriptTypes(source);
}

JSON.parse(await fs.readFile("tsconfig.json", "utf8"));
JSON.parse(await fs.readFile("electron-builder.json", "utf8"));

// Assert the deep-link plumbing actually exists — catches partial templates.
const main = await fs.readFile("src/main/index.ts", "utf8");
if (!main.includes("requestSingleInstanceLock")) {
  throw new Error("src/main/index.ts must acquire the single-instance lock (needed for Windows deep-link routing)");
}

const deeplinks = await fs.readFile("src/main/deeplinks.ts", "utf8");
if (!deeplinks.includes("open-url") || !deeplinks.includes("second-instance")) {
  throw new Error("src/main/deeplinks.ts must handle both macOS open-url and Win/Linux second-instance events");
}

const protocol = await fs.readFile("src/main/protocol.ts", "utf8");
if (!protocol.includes("registerSchemesAsPrivileged") && !protocol.includes("registerFileProtocol") && !protocol.includes("handle")) {
  throw new Error("src/main/protocol.ts must register a custom app:// protocol");
}

console.log("electron native os ok");
