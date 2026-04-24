import fs from "node:fs/promises";

const required = [
  "Cargo.toml",
  "methods/Cargo.toml",
  "methods/build.rs",
  "methods/src/lib.rs",
  "methods/guest/Cargo.toml",
  "methods/guest/src/main.rs",
  "host/Cargo.toml",
  "host/src/main.rs",
  "host/src/prover.rs",
];

for (const path of required) {
  try {
    await fs.access(path);
  } catch {
    throw new Error(`risczero-zkvm scaffold missing required file: ${path}`);
  }
}

const workspace = await fs.readFile("Cargo.toml", "utf8");
if (!workspace.includes("[workspace]")) {
  throw new Error("Cargo.toml missing [workspace] table");
}
if (!workspace.includes('resolver = "2"')) {
  throw new Error('Cargo.toml missing resolver = "2"');
}

const guestCargo = await fs.readFile("methods/guest/Cargo.toml", "utf8");
if (!guestCargo.includes("risc0-zkvm")) {
  throw new Error("methods/guest/Cargo.toml missing risc0-zkvm dep");
}

const hostCargo = await fs.readFile("host/Cargo.toml", "utf8");
if (!hostCargo.includes("risc0-zkvm") || !hostCargo.includes("methods")) {
  throw new Error("host/Cargo.toml missing risc0-zkvm or methods dep");
}

console.log("risczero-zkvm starter ok");
