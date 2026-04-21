import fs from "node:fs/promises";

const [pkgSource, mainSource, htmlSource] = await Promise.all([
  fs.readFile("package.json", "utf8"),
  fs.readFile("src/main.ts", "utf8"),
  fs.readFile("index.html", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}

const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
if (!deps.three) throw new Error("package.json missing `three` dependency");
if (!deps.vite) throw new Error("package.json missing `vite` devDependency");

if (!mainSource.includes("WebGLRenderer")) {
  throw new Error("src/main.ts should construct a THREE.WebGLRenderer");
}
if (!mainSource.includes("requestAnimationFrame")) {
  throw new Error("src/main.ts should drive a requestAnimationFrame loop");
}
if (!mainSource.includes("resize")) {
  throw new Error("src/main.ts should register a resize handler");
}

if (!htmlSource.includes('src="/src/main.ts"')) {
  throw new Error("index.html should load /src/main.ts as a module");
}

console.log("threejs game starter ok");
