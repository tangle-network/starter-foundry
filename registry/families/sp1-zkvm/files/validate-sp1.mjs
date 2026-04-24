import fs from "node:fs/promises";

const required = [
  "Cargo.toml",
  "program/Cargo.toml",
  "program/src/main.rs",
  "script/Cargo.toml",
  "script/src/main.rs",
  "script/src/prover.rs",
];

for (const path of required) {
  try {
    await fs.access(path);
  } catch {
    throw new Error(`sp1-zkvm scaffold missing required file: ${path}`);
  }
}

const programCargo = await fs.readFile("program/Cargo.toml", "utf8");
if (!programCargo.includes("sp1-zkvm")) {
  throw new Error("program/Cargo.toml missing sp1-zkvm dep");
}

const scriptCargo = await fs.readFile("script/Cargo.toml", "utf8");
if (!scriptCargo.includes("sp1-sdk") || !scriptCargo.includes("sp1-build")) {
  throw new Error("script/Cargo.toml missing sp1-sdk or sp1-build dep");
}

console.log("sp1-zkvm starter ok");
