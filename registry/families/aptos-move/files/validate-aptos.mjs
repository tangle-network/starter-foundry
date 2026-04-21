import fs from "node:fs/promises";

const [manifestSource, moduleSource, testSource] = await Promise.all([
  fs.readFile("Move.toml", "utf8"),
  fs.readFile("sources/{{moduleName}}.move", "utf8"),
  fs.readFile("tests/{{moduleName}}Tests.move", "utf8")
]);

if (!manifestSource.includes('name = "{{projectName}}"')) {
  throw new Error("Move.toml missing expected package name");
}

if (!manifestSource.includes("AptosFramework")) {
  throw new Error("Move.toml missing AptosFramework dependency (this is the Aptos Move dialect, not Sui)");
}

if (!moduleSource.includes("module {{projectName}}::{{moduleName}}")) {
  throw new Error("Move module path mismatch");
}

if (!moduleSource.includes("aptos_framework::")) {
  throw new Error("Module missing aptos_framework:: import — did you scaffold a Sui Move module by mistake?");
}

if (!moduleSource.includes("public entry fun")) {
  throw new Error("Move module missing public entry function");
}

if (!/#\[test/.test(testSource)) {
  throw new Error("Move tests missing #[test] attribute");
}

console.log("aptos move starter ok");
