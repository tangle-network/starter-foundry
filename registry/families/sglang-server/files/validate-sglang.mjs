import fs from "node:fs/promises";

const [compose, requirements, client, launch, envExample] = await Promise.all([
  fs.readFile("docker-compose.yml", "utf8"),
  fs.readFile("requirements.txt", "utf8"),
  fs.readFile("src/client.py", "utf8"),
  fs.readFile("launch.sh", "utf8"),
  fs.readFile(".env.example", "utf8"),
]);

if (!compose.includes("lmsysorg/sglang")) {
  throw new Error("docker-compose.yml missing lmsysorg/sglang image");
}
if (!compose.includes("sglang.launch_server")) {
  throw new Error("docker-compose.yml must invoke sglang.launch_server");
}
if (!compose.includes("driver: nvidia") || !compose.includes("capabilities: [gpu]")) {
  throw new Error("docker-compose.yml missing nvidia GPU device reservation");
}
if (!compose.includes("--mem-fraction-static")) {
  throw new Error("docker-compose.yml should expose --mem-fraction-static to avoid OOM");
}

if (!requirements.includes("openai") && !requirements.includes("httpx")) {
  throw new Error("requirements.txt needs openai or httpx for the client");
}

if (!client.includes("/v1/chat/completions") && !client.includes("chat.completions.create")) {
  throw new Error("src/client.py must hit OpenAI-compatible /v1/chat/completions");
}
if (!client.includes("response_format") && !client.includes("json_schema")) {
  throw new Error("src/client.py should demonstrate SGLang's constrained JSON generation");
}

if (!launch.includes("sglang.launch_server")) {
  throw new Error("launch.sh must invoke python -m sglang.launch_server");
}
if (!launch.includes("--model-path")) {
  throw new Error("launch.sh must pass --model-path");
}

if (!envExample.includes("MODEL_ID")) {
  throw new Error(".env.example missing MODEL_ID");
}
if (!envExample.includes("MEM_FRACTION_STATIC")) {
  throw new Error(".env.example should document MEM_FRACTION_STATIC");
}

console.log("sglang starter ok");
