import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number.parseInt(process.env.PORT || "{{port}}", 10);
const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

/**
 * personalize.json schema. The dev server reads this file fresh on every
 * GET / so agent edits land in the next browser refresh — no restart, no
 * import-graph hot reload, no build step. Each section is optional; the
 * scaffold defaults below take over for any missing key.
 */
type Personalize = {
  brand?: { name?: string; tagline?: string };
  hero?: { eyebrow?: string; headline?: string; subheadline?: string };
};

const PERSONALIZE_DEFAULTS: Required<{
  brand: Required<NonNullable<Personalize["brand"]>>;
  hero: Required<NonNullable<Personalize["hero"]>>;
}> = {
  brand: {
    name: "{{headline}}",
    tagline: "{{subheadline}}"
  },
  hero: {
    eyebrow: "{{projectName}}",
    headline: "{{headline}}",
    subheadline: "{{subheadline}}"
  }
};

async function loadOptionalJson(filePath: string, fallback: Record<string, string>) {
  try {
    const source = await fs.readFile(filePath, "utf8");
    return JSON.parse(source);
  } catch {
    return fallback;
  }
}

/**
 * Load personalize.json from the workspace root and merge it over the
 * scaffold's compose-time defaults. Returns a flat dot-keyed lookup
 * table the templater can read directly.
 */
async function loadPersonalize(): Promise<Record<string, string>> {
  let personalize: Personalize = {};
  try {
    const raw = await fs.readFile(path.join(rootDir, "personalize.json"), "utf8");
    personalize = JSON.parse(raw) as Personalize;
  } catch {
    // No personalize.json — fall through to defaults below.
  }

  const merged = {
    "brand.name": personalize.brand?.name ?? PERSONALIZE_DEFAULTS.brand.name,
    "brand.tagline": personalize.brand?.tagline ?? PERSONALIZE_DEFAULTS.brand.tagline,
    "hero.eyebrow": personalize.hero?.eyebrow ?? PERSONALIZE_DEFAULTS.hero.eyebrow,
    "hero.headline": personalize.hero?.headline ?? PERSONALIZE_DEFAULTS.hero.headline,
    "hero.subheadline": personalize.hero?.subheadline ?? PERSONALIZE_DEFAULTS.hero.subheadline
  };
  return merged;
}

/**
 * Substitute `{{key}}` placeholders in `template` from `values`. Keys with
 * dots (e.g. `{{brand.name}}`) are looked up verbatim in the flat table.
 * Unknown keys are left in place so missing data is visible in the
 * rendered page rather than silently dropped.
 */
function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (match, key: string) => {
    return values[key] ?? match;
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${port}`);

  if (requestUrl.pathname === "/api/health") {
    const database = await loadOptionalJson(path.join(rootDir, "database-config.json"), {
      provider: "{{databaseProvider}}"
    });
    const hooksPath = path.join(rootDir, "hooks.mjs");
    const hooksPresent = await fs.access(hooksPath).then(() => true).catch(() => false);
    const payload = JSON.stringify({
      status: "ok",
      service: "{{serviceName}}",
      database: database.provider ?? "{{databaseProvider}}",
      hooks: hooksPresent
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(payload);
    return;
  }

  // GET / and explicit /index.html: render the template with the latest
  // personalize.json. We re-read both files on every request so agent
  // edits show up immediately on the next browser refresh — no HMR,
  // no restart, no build step.
  if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
    try {
      const [template, values] = await Promise.all([
        fs.readFile(path.join(rootDir, "web", "index.html"), "utf8"),
        loadPersonalize()
      ]);
      const rendered = renderTemplate(template, values);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(rendered);
    } catch (err) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(`failed to render index.html: ${(err as Error).message}`);
    }
    return;
  }

  // /personalize.css and /personalize.json — agent-editable static assets,
  // served from the workspace root (NOT web/) so a single source-of-truth
  // file works for both the dev server and any post-compose tooling.
  if (
    requestUrl.pathname === "/personalize.css" ||
    requestUrl.pathname === "/personalize.json"
  ) {
    try {
      const filePath = path.join(rootDir, requestUrl.pathname.slice(1));
      const content = await fs.readFile(filePath);
      response.writeHead(200, {
        "content-type": mimeTypes[path.extname(filePath)] || "text/plain; charset=utf-8"
      });
      response.end(content);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
    return;
  }

  // Everything else: serve from web/ as a static file.
  const resolvedPath = requestUrl.pathname.slice(1);
  const filePath = path.join(rootDir, "web", resolvedPath);

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "text/plain; charset=utf-8"
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`fullstack preview listening on ${port}`);
});
