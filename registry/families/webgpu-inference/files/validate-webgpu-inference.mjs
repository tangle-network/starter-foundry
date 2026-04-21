import fs from "node:fs/promises";

const [pkgSource, mainSource, shaderSource, htmlSource, tsconfigSource] = await Promise.all([
  fs.readFile("package.json", "utf8"),
  fs.readFile("src/main.ts", "utf8"),
  fs.readFile("src/shaders/matmul.wgsl", "utf8"),
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
if (!mainSource.includes("createComputePipeline")) {
  throw new Error("src/main.ts should create a GPU compute pipeline");
}
if (!mainSource.includes("dispatchWorkgroups")) {
  throw new Error("src/main.ts should dispatch workgroups");
}
if (!mainSource.includes("GPUBufferUsage")) {
  throw new Error("src/main.ts should allocate GPU buffers");
}

if (!shaderSource.includes("@compute")) {
  throw new Error("src/shaders/matmul.wgsl must declare an @compute entry point");
}
if (!shaderSource.includes("@workgroup_size")) {
  throw new Error("src/shaders/matmul.wgsl must declare a @workgroup_size");
}

if (!htmlSource.includes('src="/src/main.ts"')) {
  throw new Error("index.html should load /src/main.ts as a module");
}

if (!tsconfigSource.includes("@webgpu/types")) {
  throw new Error("tsconfig.json should include @webgpu/types in the types array");
}

console.log("webgpu-inference starter ok");
