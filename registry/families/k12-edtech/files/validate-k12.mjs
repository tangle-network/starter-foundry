import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const paths = [
  "src/server.ts",
  "src/db/schema.ts",
  "src/api/classroom.ts",
  "src/api/gradebook.ts",
];
const sources = await Promise.all(paths.map((p) => fs.readFile(p, "utf8")));
for (const s of sources) stripTypeScriptTypes(s);
const [server, schema, classroom, gradebook] = sources;

const required = ["students", "teachers", "classes", "assignments", "submissions", "grades", "parents"];
for (const t of required) {
  if (!schema.includes(t)) throw new Error(`schema.ts missing table: ${t}`);
}

if (!gradebook.includes("auditLog") && !gradebook.includes("audit_log") && !gradebook.includes("gradeAccess")) {
  throw new Error("gradebook.ts must write an audit-log row on grade reads (FERPA)");
}

if (!server.includes('/health')) {
  throw new Error("server.ts missing /health route");
}

JSON.parse(await fs.readFile("package.json", "utf8"));
console.log("k12 starter ok");
