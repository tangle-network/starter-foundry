import fs from "node:fs/promises";

const required = [
  "Cargo.toml",
  "src/main.rs",
  "src/circuit.rs",
  "src/prover.rs",
];

for (const path of required) {
  try {
    await fs.access(path);
  } catch {
    throw new Error(`arkworks-prover scaffold missing required file: ${path}`);
  }
}

const cargo = await fs.readFile("Cargo.toml", "utf8");
for (const dep of ["ark-bn254", "ark-groth16", "ark-r1cs-std", "ark-snark"]) {
  if (!cargo.includes(dep)) {
    throw new Error(`Cargo.toml missing ${dep} dep`);
  }
}

console.log("arkworks-prover starter ok");
