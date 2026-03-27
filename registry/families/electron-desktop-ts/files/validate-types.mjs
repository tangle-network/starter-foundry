import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const files = ["src/main.ts", "src/preload.ts", "renderer/app.ts"];

for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  stripTypeScriptTypes(source);
}

JSON.parse(await fs.readFile("tsconfig.json", "utf8"));
console.log("typescript ok");
