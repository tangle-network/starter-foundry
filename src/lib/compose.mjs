import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, sanitizePackageName, writeJson } from "./fs.mjs";
import { buildVariables, resolveComponents, resolveTemplateObject } from "./registry.mjs";

async function renderFile(sourcePath, targetPath, variables) {
  const raw = await fs.readFile(sourcePath, "utf8");
  const rendered = raw.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (key in variables) {
      return String(variables[key]);
    }
    return "";
  });
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, rendered, "utf8");
}

function collectComponentFiles(component) {
  return (component.files ?? []).map((file) => ({
    ...file,
    source: path.join(component.baseDir, file.source),
    owner: component.kind === "layer" ? `${component.group}:${component.id}` : component.id,
  }));
}

function buildComponentOrder(components) {
  const order = [components.family, ...components.layers];
  if (components.partner) {
    order.push(components.partner);
  }
  return order;
}

function collectValidationChecks(components, variables) {
  return buildComponentOrder(components).flatMap((component) =>
    resolveTemplateObject(component.validationChecks ?? [], variables),
  );
}

function collectContextHints(components, variables) {
  const merged = {
    commands: [],
    entrypoints: [],
    preview: null,
    extensionPoints: [],
  };

  for (const component of buildComponentOrder(components)) {
    const hints = resolveTemplateObject(component.contextHints ?? {}, variables);
    merged.commands.push(...(hints.commands ?? []));
    merged.entrypoints.push(...(hints.entrypoints ?? []));
    merged.extensionPoints.push(...(hints.extensionPoints ?? []));
    if (hints.preview) {
      merged.preview = hints.preview;
    }
  }

  merged.commands = [...new Set(merged.commands)];
  merged.entrypoints = [...new Set(merged.entrypoints)];
  merged.extensionPoints = [...new Set(merged.extensionPoints)];

  return merged;
}

export async function composeStarter({ spec, outDir }) {
  const components = await resolveComponents(spec);
  const variables = buildVariables(
    {
      ...spec,
      packageName: spec.packageName ?? sanitizePackageName(spec.projectName),
    },
    components,
  );
  const componentOrder = buildComponentOrder(components);
  const fileOwnership = {};
  const filesWritten = [];

  await ensureDir(outDir);

  for (const component of componentOrder) {
    const files = collectComponentFiles(component);
    for (const file of files) {
      const resolvedTarget = resolveTemplateObject(file.target, variables);
      const targetPath = path.join(outDir, resolvedTarget);
      await renderFile(file.source, targetPath, variables);
      fileOwnership[resolvedTarget] = file.owner;
      filesWritten.push(resolvedTarget);
    }
  }

  const composeReport = {
    spec,
    components: {
      family: components.family.id,
      layers: components.layers.map((layer) => `${layer.group}:${layer.id}`),
      partner: components.partner?.id ?? null,
      slots: components.slotSelections,
    },
    variables,
    fileOwnership,
    validationChecks: collectValidationChecks(components, variables),
    contextHints: collectContextHints(components, variables),
  };

  await ensureDir(path.join(outDir, ".starter-foundry"));
  await writeJson(path.join(outDir, ".starter-foundry", "compose-report.json"), composeReport);

  return {
    outDir,
    filesWritten: [...new Set(filesWritten)].sort(),
    composeReportPath: path.join(outDir, ".starter-foundry", "compose-report.json"),
    components: composeReport.components,
  };
}
