import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const files = ["src/background.ts", "src/popup.ts", "src/content.ts"];

for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  stripTypeScriptTypes(source);
}

JSON.parse(await fs.readFile("manifest.json", "utf8"));
JSON.parse(await fs.readFile("tsconfig.json", "utf8"));
console.log("typescript ok");
