import fs from "node:fs/promises";

const [manifestSource, moduleSource, testSource] = await Promise.all([
  fs.readFile("Move.toml", "utf8"),
  fs.readFile("sources/{{moduleName}}.move", "utf8"),
  fs.readFile("tests/{{moduleName}}Tests.move", "utf8")
]);

if (!manifestSource.includes('name = "{{projectName}}"')) {
  throw new Error("Move.toml missing expected package name");
}

if (!moduleSource.includes("module {{projectName}}::{{moduleName}}")) {
  throw new Error("Move module path mismatch");
}

if (!moduleSource.includes("public entry fun initialize")) {
  throw new Error("Move entry function missing");
}

if (!/#\[test/.test(testSource)) {
  throw new Error("Move tests missing #[test]");
}

console.log("move starter ok");
