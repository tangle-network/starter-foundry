import fs from "node:fs/promises";

const [compose, config, submit, client, gomod] = await Promise.all([
  fs.readFile("docker-compose.yml", "utf8"),
  fs.readFile("config.toml", "utf8"),
  fs.readFile("submit-blob.sh", "utf8"),
  fs.readFile("client/main.go", "utf8"),
  fs.readFile("go.mod", "utf8"),
]);

if (!compose.includes("ghcr.io/celestiaorg/celestia-node")) {
  throw new Error("docker-compose.yml missing celestia-node image");
}

if (!compose.includes("light")) {
  throw new Error("docker-compose.yml should run the light-node mode by default");
}

if (!config.includes("RPC")) {
  throw new Error("config.toml missing [RPC] section");
}

if (!submit.includes("blob.Submit") && !submit.includes("state.SubmitPayForBlob") && !submit.includes("blob submit")) {
  throw new Error("submit-blob.sh missing celestia blob submit incantation");
}

if (!client.includes("package main") || !client.includes("func main")) {
  throw new Error("client/main.go missing main entrypoint");
}

if (!client.includes("blob.Submit") && !client.includes("/blob/submit")) {
  throw new Error("client/main.go missing blob submit call to Celestia RPC");
}

if (!client.includes("blob.GetAll") && !client.includes("/blob/get_all")) {
  throw new Error("client/main.go missing blob retrieval call");
}

if (!gomod.includes("module {{packageName}}")) {
  throw new Error("go.mod missing expected module path");
}

console.log("celestia starter ok");
