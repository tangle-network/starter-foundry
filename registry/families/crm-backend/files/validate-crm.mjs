import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const paths = [
  "src/server.ts",
  "src/db/schema.ts",
  "src/api/pipeline.ts",
  "src/api/reporting.ts",
];
const sources = await Promise.all(paths.map((p) => fs.readFile(p, "utf8")));
for (const s of sources) stripTypeScriptTypes(s);
const [server, schema, pipeline, reporting] = sources;

const required = ["contacts", "companies", "deals", "activities", "stages"];
for (const t of required) {
  if (!schema.includes(t)) throw new Error(`schema.ts missing table: ${t}`);
}

if (!pipeline.includes("moveDealStage") && !pipeline.includes("moveDeal") && !pipeline.includes("stageId")) {
  throw new Error("pipeline.ts must expose a deal-stage move endpoint");
}

if (!reporting.includes("wonAmount") && !reporting.includes("won_amount") && !reporting.includes("won amount")) {
  throw new Error("reporting.ts must expose a won-amount-by-month report");
}

if (!server.includes('/health')) {
  throw new Error("server.ts missing /health route");
}

JSON.parse(await fs.readFile("package.json", "utf8"));
console.log("crm starter ok");
