import fs from "node:fs/promises";

const files = [
  "package.json",
  "tsconfig.json",
  "hardhat.config.ts",
  "contracts/{{contractName}}.sol",
  "scripts/deploy.ts",
  "test/{{contractName}}.test.ts",
];

await Promise.all(files.map((file) => fs.access(file)));
console.log("hardhat starter ok");
