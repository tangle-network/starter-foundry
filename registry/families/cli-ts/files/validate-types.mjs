import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const source = await fs.readFile("src/index.ts", "utf8");
stripTypeScriptTypes(source);
JSON.parse(await fs.readFile("tsconfig.json", "utf8"));
console.log("typescript ok");
