import fs from "node:fs/promises";

const [requirements, service, skyServe, readme, envExample] = await Promise.all([
  fs.readFile("requirements.txt", "utf8"),
  fs.readFile("service.yaml", "utf8"),
  fs.readFile("sky-serve.yaml", "utf8"),
  fs.readFile("README.md", "utf8"),
  fs.readFile(".env.example", "utf8"),
]);

if (!requirements.includes("skypilot")) {
  throw new Error("requirements.txt missing skypilot");
}

for (const token of ["service:", "readiness_probe", "resources:", "accelerators", "run:"]) {
  if (!service.includes(token)) {
    throw new Error(`service.yaml missing ${token}`);
  }
}
if (!service.includes("vllm") && !service.includes("openai.api_server")) {
  throw new Error("service.yaml run: block should launch a vLLM / OpenAI-compatible server");
}
if (!service.includes("MODEL_ID")) {
  throw new Error("service.yaml should plumb MODEL_ID via envs:");
}

for (const token of ["controller", "replica_policy", "load_balancing_policy"]) {
  if (!skyServe.includes(token)) {
    throw new Error(`sky-serve.yaml missing ${token}`);
  }
}

if (!readme.includes("sky serve up") || !readme.includes("sky serve down")) {
  throw new Error("README.md must document both `sky serve up` and `sky serve down` (cost safety)");
}

if (!envExample.includes("HF_TOKEN")) {
  throw new Error(".env.example missing HF_TOKEN");
}

console.log("skypilot starter ok");
