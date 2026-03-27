import fs from "node:fs/promises";

const config = JSON.parse(await fs.readFile("avs.config.json", "utf8"));
if (!config.name || !config.operator || !config.contracts?.serviceManager) {
  throw new Error("invalid avs config");
}

const serviceManager = await fs.readFile("contracts/ServiceManager.sol", "utf8");
if (!serviceManager.includes("contract ServiceManager")) {
  throw new Error("missing ServiceManager contract");
}

const operator = await fs.readFile("operator/main.rs", "utf8");
if (!operator.includes("operator heartbeat")) {
  throw new Error("missing operator heartbeat");
}

console.log("avs ok");
