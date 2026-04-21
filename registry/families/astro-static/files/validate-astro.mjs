import fs from "node:fs/promises";

const [pkgSource, configSource, indexSource] = await Promise.all([
  fs.readFile("package.json", "utf8"),
  fs.readFile("astro.config.mjs", "utf8"),
  fs.readFile("src/pages/index.astro", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}

if (!pkg.dependencies?.astro) {
  throw new Error("package.json missing astro dependency");
}

if (!configSource.includes("defineConfig")) {
  throw new Error("astro.config.mjs should call defineConfig()");
}

if (!indexSource.includes("---")) {
  throw new Error("src/pages/index.astro missing frontmatter fence (---)");
}

console.log("astro starter ok");
