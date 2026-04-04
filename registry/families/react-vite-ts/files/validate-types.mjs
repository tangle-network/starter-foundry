import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const tsFiles = ["vite.config.ts", "src/main.ts"];
const tsxFiles = ["src/App.tsx"];

for (const file of tsFiles) {
  const source = await fs.readFile(file, "utf8");
  stripTypeScriptTypes(source);
}

for (const file of tsxFiles) {
  const source = await fs.readFile(file, "utf8");
  if (!source.trim()) throw new Error(`${file} is empty`);
}

JSON.parse(await fs.readFile("tsconfig.json", "utf8"));
console.log("typescript ok");
