import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const paths = [
  "src/server.ts",
  "src/db/schema.ts",
  "src/ledger/post.ts",
  "src/ledger/query.ts",
];
const sources = await Promise.all(paths.map((p) => fs.readFile(p, "utf8")));
for (const s of sources) stripTypeScriptTypes(s);
const [server, schema, post, query] = sources;

if (!schema.includes("accounts") || !schema.includes("entries") || !schema.includes("transactions")) {
  throw new Error("schema.ts missing required tables (accounts, transactions, entries)");
}

if (!schema.includes("numeric") && !schema.includes("NUMERIC")) {
  throw new Error("schema.ts amounts MUST use numeric (not real/float) — float destroys cents");
}

if (/\bfloat\b|\bdouble\b|\breal\b/i.test(schema)) {
  throw new Error("schema.ts appears to use float/double/real for money — that's a data-integrity bug");
}

if (!post.includes("Decimal") && !post.includes("decimal.js")) {
  throw new Error("post.ts must use decimal.js for amount arithmetic — never JavaScript numbers");
}

if (!/debit\s*[+=]|debits|sum.*debit/i.test(post) || !/credit/i.test(post)) {
  throw new Error("post.ts must enforce debit = credit balance per transaction");
}

if (!query.includes("balance") && !query.includes("Balance")) {
  throw new Error("query.ts missing balance function");
}

if (!server.includes('/health')) {
  throw new Error("server.ts missing /health route");
}

JSON.parse(await fs.readFile("package.json", "utf8"));
console.log("ledger starter ok");
