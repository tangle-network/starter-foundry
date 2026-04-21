import fs from "node:fs/promises";

const [pkgSource, mainSource, shaderSource, htmlSource, tsconfigSource] = await Promise.all([
  fs.readFile("package.json", "utf8"),
  fs.readFile("src/main.ts", "utf8"),
  fs.readFile("src/shaders/main.wgsl", "utf8"),
  fs.readFile("index.html", "utf8"),
  fs.readFile("tsconfig.json", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}

const devDeps = pkg.devDependencies ?? {};
if (!devDeps["@webgpu/types"]) {
  throw new Error("package.json missing `@webgpu/types` devDependency");
}
if (!devDeps.vite) {
  throw new Error("package.json missing `vite` devDependency");
}

if (!mainSource.includes("navigator.gpu")) {
  throw new Error("src/main.ts should call navigator.gpu.requestAdapter()");
}
if (!mainSource.includes("createRenderPipeline")) {
  throw new Error("src/main.ts should create a GPU render pipeline");
}
if (!mainSource.includes("beginRenderPass")) {
  throw new Error("src/main.ts should open a render pass");
}
if (!mainSource.includes("getContext")) {
  throw new Error("src/main.ts should acquire a webgpu canvas context");
}
if (!mainSource.includes("requestAnimationFrame")) {
  throw new Error("src/main.ts should drive a requestAnimationFrame render loop");
}

if (!shaderSource.includes("@vertex")) {
  throw new Error("src/shaders/main.wgsl must declare a @vertex entry point");
}
if (!shaderSource.includes("@fragment")) {
  throw new Error("src/shaders/main.wgsl must declare a @fragment entry point");
}

if (!htmlSource.includes('src="/src/main.ts"')) {
  throw new Error("index.html should load /src/main.ts as a module");
}
if (!htmlSource.includes('id="scene"')) {
  throw new Error("index.html must include a <canvas id=\"scene\"> for the render target");
}

if (!tsconfigSource.includes("@webgpu/types")) {
  throw new Error("tsconfig.json should include @webgpu/types in the types array");
}

console.log("webgpu-render starter ok");
