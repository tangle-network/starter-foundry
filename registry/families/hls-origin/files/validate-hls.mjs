// Structural validator for hls-origin. Does NOT launch ffmpeg/nginx — just
// cross-checks that the pipeline wiring is coherent.

import fs from "node:fs/promises";

const [pkgSource, serverSource, composeSource, nginxConf, streamScript] = await Promise.all([
  fs.readFile("package.json", "utf8"),
  fs.readFile("src/server.ts", "utf8"),
  fs.readFile("docker-compose.yml", "utf8"),
  fs.readFile("nginx.conf", "utf8"),
  fs.readFile("start-stream.sh", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}

if (!serverSource.includes('"/health"') && !serverSource.includes("'/health'")) {
  throw new Error("src/server.ts missing /health route contract");
}
if (!serverSource.includes('/streams')) {
  throw new Error("src/server.ts must expose a /streams listing endpoint");
}

if (!composeSource.includes("nginx")) {
  throw new Error("docker-compose.yml must include an nginx service for HLS segment delivery");
}
if (!composeSource.includes("ffmpeg")) {
  throw new Error("docker-compose.yml must include an ffmpeg service for transcoding");
}
if (!composeSource.includes("hls-data")) {
  throw new Error("docker-compose.yml must share an hls-data volume between nginx and ffmpeg");
}

if (!nginxConf.includes("Access-Control-Allow-Origin")) {
  throw new Error("nginx.conf must set CORS headers — HLS.js will refuse cross-origin playlists without them");
}
if (!nginxConf.includes(".m3u8")) {
  throw new Error("nginx.conf must have an explicit .m3u8 location block");
}

if (!streamScript.includes("hls_flags")) {
  throw new Error("start-stream.sh must pass -hls_flags to ffmpeg");
}
if (!streamScript.includes("delete_segments")) {
  throw new Error("start-stream.sh must use delete_segments or the origin will fill disk");
}

console.log("hls-origin starter ok");
