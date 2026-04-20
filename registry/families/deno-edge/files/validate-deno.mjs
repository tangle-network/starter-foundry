import fs from "node:fs/promises";

const [serverSource, denoJson] = await Promise.all([
  fs.readFile("src/server.ts", "utf8"),
  fs.readFile("deno.json", "utf8"),
]);

const config = JSON.parse(denoJson);
if (config.name !== "{{packageName}}") {
  throw new Error(`deno.json name should be "{{packageName}}", got "${config.name}"`);
}

if (!serverSource.includes("Deno.serve")) {
  throw new Error("src/server.ts should call Deno.serve");
}

if (!serverSource.includes('"/health"')) {
  throw new Error("src/server.ts missing /health route contract");
}

console.log("deno starter ok");
