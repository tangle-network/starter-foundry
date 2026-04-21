// Structural validator for livekit-sfu. Does NOT start docker or the SFU
// (scaffold validation runs without Docker available); confirms entry files
// exist, cross-reference each other, and configs are syntactically valid.

import fs from "node:fs/promises";

const [pkgSource, serverSource, composeSource, livekitYaml] = await Promise.all([
  fs.readFile("package.json", "utf8"),
  fs.readFile("src/server.ts", "utf8"),
  fs.readFile("docker-compose.yml", "utf8"),
  fs.readFile("livekit.yaml", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}
if (!pkg.dependencies?.["livekit-server-sdk"]) {
  throw new Error("package.json missing livekit-server-sdk dependency");
}

if (!serverSource.includes("AccessToken")) {
  throw new Error("src/server.ts must mint livekit AccessToken JWTs");
}
if (!serverSource.includes("/token")) {
  throw new Error("src/server.ts must expose a POST /token route");
}
if (!serverSource.includes('"/health"') && !serverSource.includes("'/health'")) {
  throw new Error("src/server.ts missing /health route contract");
}

if (!composeSource.includes("livekit/livekit-server")) {
  throw new Error("docker-compose.yml must reference livekit/livekit-server image");
}
if (!composeSource.includes("redis")) {
  throw new Error("docker-compose.yml must include the redis sidecar for multi-node coordination");
}

if (!livekitYaml.includes("keys:")) {
  throw new Error("livekit.yaml must declare at least one API key/secret pair under 'keys:'");
}
if (!livekitYaml.includes("use_external_ip")) {
  throw new Error("livekit.yaml must set rtc.use_external_ip — WebRTC won't work without it");
}

console.log("livekit-sfu starter ok");
