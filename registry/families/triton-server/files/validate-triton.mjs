import fs from "node:fs/promises";

const [compose, requirements, client, config] = await Promise.all([
  fs.readFile("docker-compose.yml", "utf8"),
  fs.readFile("requirements.txt", "utf8"),
  fs.readFile("src/client.py", "utf8"),
  fs.readFile("model_repository/identity/config.pbtxt", "utf8"),
]);

if (!compose.includes("nvcr.io/nvidia/tritonserver")) {
  throw new Error("docker-compose.yml missing nvcr.io/nvidia/tritonserver image");
}
if (!compose.includes("--model-repository")) {
  throw new Error("docker-compose.yml must pass --model-repository to tritonserver");
}
if (!compose.includes("8000") || !compose.includes("8001") || !compose.includes("8002")) {
  throw new Error("docker-compose.yml must expose Triton's HTTP(8000), gRPC(8001), metrics(8002)");
}
if (!compose.includes("driver: nvidia") || !compose.includes("capabilities: [gpu]")) {
  throw new Error("docker-compose.yml missing nvidia GPU device reservation");
}

if (!requirements.includes("tritonclient")) {
  throw new Error("requirements.txt missing tritonclient");
}

if (!client.includes("tritonclient")) {
  throw new Error("src/client.py must import tritonclient");
}
if (!client.includes("InferInput") || !client.includes("InferRequestedOutput")) {
  throw new Error("src/client.py must use InferInput/InferRequestedOutput");
}
if (!client.includes("is_server_ready") && !client.includes("is_model_ready")) {
  throw new Error("src/client.py should check server/model readiness before inferring");
}

if (!config.includes("name:") || !config.includes("identity")) {
  throw new Error("config.pbtxt missing name declaration");
}
if (!config.includes("input [") || !config.includes("output [")) {
  throw new Error("config.pbtxt missing input/output tensor declarations");
}
if (!config.includes("max_batch_size")) {
  throw new Error("config.pbtxt must declare max_batch_size");
}

// Verify version dir placeholder exists.
const gitkeep = await fs.readFile("model_repository/identity/1/.gitkeep", "utf8").catch(() => null);
if (gitkeep === null) {
  throw new Error("model_repository/identity/1/.gitkeep missing — integer version dir is required");
}

console.log("triton starter ok");
