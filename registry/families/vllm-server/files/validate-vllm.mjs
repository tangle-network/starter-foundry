import fs from "node:fs/promises";

const [serverSource, requirements, config] = await Promise.all([
  fs.readFile("src/server.py", "utf8"),
  fs.readFile("requirements.txt", "utf8"),
  fs.readFile("config.yaml", "utf8"),
]);

if (!requirements.includes("vllm")) {
  throw new Error("requirements.txt missing vllm");
}
if (!requirements.includes("fastapi") && !requirements.includes("uvicorn")) {
  throw new Error("requirements.txt must include a Python ASGI framework (fastapi + uvicorn)");
}

if (!serverSource.includes("AsyncLLMEngine") && !serverSource.includes("LLMEngine") && !serverSource.includes("OpenAIServingChat")) {
  throw new Error("src/server.py must wire up a vLLM engine or OpenAIServingChat wrapper");
}
if (!serverSource.includes("/health")) {
  throw new Error("src/server.py missing /health route contract");
}

if (!config.includes("{{modelId}}")) {
  // Variable substitution happened at compose time — just ensure the model key exists.
  if (!config.includes("model:")) {
    throw new Error("config.yaml missing 'model:' section");
  }
}

console.log("vllm starter ok");
