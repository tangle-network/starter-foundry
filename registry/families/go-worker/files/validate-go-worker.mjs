import fs from "node:fs/promises";

const goMod = await fs.readFile("go.mod", "utf8");
const mainSource = await fs.readFile("cmd/worker/main.go", "utf8");

if (!goMod.includes("module ")) {
  throw new Error("missing module declaration");
}

if (!mainSource.includes("package main") || !mainSource.includes("cycle complete")) {
  throw new Error("go worker source missing expected runtime seams");
}

console.log("go worker ok");
