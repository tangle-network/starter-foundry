import fs from "node:fs/promises";
import path from "node:path";
import { readJson, resolveRepoRoot } from "./fs.mjs";

const repoRoot = resolveRepoRoot();
const registryRoot = path.join(repoRoot, "registry");

function interpolateString(value, variables) {
  return value.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (key in variables) {
      return String(variables[key]);
    }
    return "";
  });
}

export function interpolateValue(value, variables) {
  if (typeof value === "string") {
    return interpolateString(value, variables);
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, variables));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolateValue(item, variables)]),
    );
  }

  return value;
}

async function readManifest(manifestPath, kind, group = null) {
  const manifest = await readJson(manifestPath);
  return {
    ...manifest,
    kind,
    group,
    manifestPath,
    baseDir: path.dirname(manifestPath),
  };
}

async function loadFamilies() {
  const familiesDir = path.join(registryRoot, "families");
  const ids = await fs.readdir(familiesDir);
  const manifests = await Promise.all(
    ids.map((id) => readManifest(path.join(familiesDir, id, "manifest.json"), "family")),
  );
  return new Map(manifests.map((manifest) => [manifest.id, manifest]));
}

async function loadLayerGroups() {
  const layersDir = path.join(registryRoot, "layers");
  const groups = await fs.readdir(layersDir);
  const manifests = [];

  for (const group of groups) {
    const groupDir = path.join(layersDir, group);
    const ids = await fs.readdir(groupDir);
    for (const id of ids) {
      manifests.push(await readManifest(path.join(groupDir, id, "manifest.json"), "layer", group));
    }
  }

  return new Map(manifests.map((manifest) => [`${manifest.group}:${manifest.id}`, manifest]));
}

async function loadPartners() {
  const partnersDir = path.join(registryRoot, "partners");
  const ids = await fs.readdir(partnersDir);
  const manifests = await Promise.all(
    ids.map((id) => readManifest(path.join(partnersDir, id, "manifest.json"), "partner")),
  );
  return new Map(manifests.map((manifest) => [manifest.id, manifest]));
}

let registryPromise = null;

export async function loadRegistry() {
  if (!registryPromise) {
    registryPromise = Promise.all([loadFamilies(), loadLayerGroups(), loadPartners()]).then(
      ([families, layers, partners]) => ({
        families,
        layers,
        partners,
      }),
    );
  }

  return registryPromise;
}

export async function listRegistry() {
  const registry = await loadRegistry();
  return {
    families: [...registry.families.values()].map((item) => ({
      id: item.id,
      description: item.description,
      tags: item.tags,
      slots: item.slots ?? {},
    })),
    layers: [...registry.layers.values()].map((item) => ({
      id: `${item.group}:${item.id}`,
      appliesTo: item.appliesTo,
      description: item.description,
      slot: item.slot ?? null,
    })),
    partners: [...registry.partners.values()].map((item) => ({
      id: item.id,
      description: item.description,
      slotDefaults: item.slotDefaults ?? {},
    })),
  };
}

export async function loadProjectSpec(specPath) {
  return readJson(path.resolve(specPath));
}

function assertCompatibleLayer(layer, familyId) {
  if (Array.isArray(layer.appliesTo) && !layer.appliesTo.includes(familyId)) {
    throw new Error(`Layer ${layer.group}:${layer.id} is not compatible with family ${familyId}`);
  }
}

function assertCompatiblePartner(partner, familyId) {
  if (Array.isArray(partner.appliesTo) && !partner.appliesTo.includes(familyId)) {
    throw new Error(`Partner ${partner.id} is not compatible with family ${familyId}`);
  }
}

function assertSlotSelection(family, slotName, layerId) {
  const slot = family.slots?.[slotName];
  if (!slot) {
    throw new Error(`Family ${family.id} does not define slot ${slotName}`);
  }

  if (Array.isArray(slot.options) && !slot.options.includes(layerId)) {
    throw new Error(`Layer ${layerId} is not a valid option for slot ${slotName} on family ${family.id}`);
  }
}

function buildSlotSelections(spec, family, partner, explicitLayers) {
  const slotSelections = {};

  for (const [slotName, slotConfig] of Object.entries(family.slots ?? {})) {
    if (slotConfig.default) {
      slotSelections[slotName] = slotConfig.default;
    }
  }

  for (const [slotName, layerId] of Object.entries(partner?.slotDefaults ?? {})) {
    if (family.slots?.[slotName]) {
      slotSelections[slotName] = layerId;
    }
  }

  for (const [slotName, layerId] of Object.entries(spec.slots ?? {})) {
    slotSelections[slotName] = layerId;
  }

  for (const layer of explicitLayers) {
    if (layer.slot) {
      slotSelections[layer.slot] = `${layer.group}:${layer.id}`;
    }
  }

  for (const [slotName, layerId] of Object.entries(slotSelections)) {
    assertSlotSelection(family, slotName, layerId);
  }

  return slotSelections;
}

export async function resolveComponents(spec) {
  const registry = await loadRegistry();
  const family = registry.families.get(spec.family);

  if (!family) {
    throw new Error(`Unknown family ${spec.family}`);
  }

  const explicitLayers = (spec.layers ?? []).map((layerId) => {
    const layer = registry.layers.get(layerId);
    if (!layer) {
      throw new Error(`Unknown layer ${layerId}`);
    }
    assertCompatibleLayer(layer, family.id);
    return layer;
  });

  const partner = spec.partner ? registry.partners.get(spec.partner) : null;
  if (spec.partner && !partner) {
    throw new Error(`Unknown partner ${spec.partner}`);
  }
  if (partner) {
    assertCompatiblePartner(partner, family.id);
  }

  const slotSelections = buildSlotSelections(spec, family, partner, explicitLayers);
  const layers = [...explicitLayers];

  for (const [slotName, layerId] of Object.entries(slotSelections)) {
    const alreadyIncluded = layers.some((layer) => layer.slot === slotName);
    if (alreadyIncluded) {
      continue;
    }

    const layer = registry.layers.get(layerId);
    if (!layer) {
      throw new Error(`Unknown layer ${layerId} for slot ${slotName}`);
    }
    assertCompatibleLayer(layer, family.id);
    layers.push(layer);
  }

  return {
    family,
    layers,
    partner,
    slotSelections,
  };
}

export function buildVariables(spec, components) {
  const variables = {
    projectName: spec.projectName,
    packageName: spec.packageName ?? spec.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    ...components.family.defaults,
  };

  for (const layer of components.layers) {
    Object.assign(variables, layer.defaults ?? {});
  }

  if (components.partner) {
    Object.assign(variables, components.partner.defaults ?? {});
  }

  Object.assign(variables, components.slotSelections ?? {});
  Object.assign(variables, spec.variables ?? {});
  return variables;
}

export function resolveTemplateObject(value, variables) {
  return interpolateValue(value, variables);
}
