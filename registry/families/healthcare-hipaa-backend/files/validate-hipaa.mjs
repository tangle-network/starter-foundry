import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const paths = [
  "src/server.ts",
  "src/db/schema.ts",
  "src/encryption.ts",
  "src/api/phi-access.ts",
];

const sources = await Promise.all(paths.map((p) => fs.readFile(p, "utf8")));
const [server, schema, enc, phiAccess] = sources;

for (const [p, s] of paths.map((p, i) => [p, sources[i]])) {
  stripTypeScriptTypes(s);
}

if (!schema.includes("patients") || !schema.includes("encounters") || !schema.includes("providers") || !schema.includes("audit_logs") && !schema.includes("auditLogs")) {
  throw new Error("src/db/schema.ts missing required tables (patients, encounters, providers, audit_logs)");
}

if (!enc.includes("aes-256-gcm") && !enc.includes("AES-256-GCM")) {
  throw new Error("src/encryption.ts must use AES-256-GCM for PHI field encryption");
}

if (!phiAccess.includes("auditLog") && !phiAccess.includes("audit_log")) {
  throw new Error("src/api/phi-access.ts must write to audit_logs on every PHI read");
}

if (!server.includes('/health')) {
  throw new Error("src/server.ts missing /health route");
}

JSON.parse(await fs.readFile("package.json", "utf8"));
console.log("hipaa starter ok");
