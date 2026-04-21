import fs from "node:fs/promises";

const [compose, requirements, client, envExample] = await Promise.all([
  fs.readFile("docker-compose.yml", "utf8"),
  fs.readFile("requirements.txt", "utf8"),
  fs.readFile("src/client.py", "utf8"),
  fs.readFile(".env.example", "utf8"),
]);

if (!compose.includes("ghcr.io/huggingface/text-generation-inference")) {
  throw new Error("docker-compose.yml missing TGI image reference");
}
if (!compose.includes("driver: nvidia") || !compose.includes("capabilities: [gpu]")) {
  throw new Error("docker-compose.yml missing nvidia GPU device reservation");
}
if (!compose.includes("shm_size")) {
  throw new Error("docker-compose.yml missing shm_size (NCCL crashes on default 64MB)");
}
if (!compose.includes("/data")) {
  throw new Error("docker-compose.yml missing model volume mount at /data");
}

if (!requirements.includes("huggingface_hub")) {
  throw new Error("requirements.txt missing huggingface_hub");
}
if (!requirements.includes("httpx")) {
  throw new Error("requirements.txt missing httpx");
}

if (!client.includes("/generate")) {
  throw new Error("src/client.py must hit TGI's /generate endpoint");
}
if (!client.includes("httpx")) {
  throw new Error("src/client.py must import httpx");
}

if (!envExample.includes("MODEL_ID")) {
  throw new Error(".env.example missing MODEL_ID");
}
if (!envExample.includes("HUGGING_FACE_HUB_TOKEN")) {
  throw new Error(".env.example missing HUGGING_FACE_HUB_TOKEN");
}

console.log("tgi starter ok");
