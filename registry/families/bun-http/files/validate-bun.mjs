import fs from "node:fs/promises";

const [serverSource, pkgSource] = await Promise.all([
  fs.readFile("src/server.ts", "utf8"),
  fs.readFile("package.json", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}

if (!serverSource.includes("Bun.serve") && !serverSource.includes("export default")) {
  throw new Error("src/server.ts should export a Bun.serve-compatible config or call Bun.serve directly");
}

if (!serverSource.includes('"/health"')) {
  throw new Error("src/server.ts missing /health route contract");
}

console.log("bun starter ok");
