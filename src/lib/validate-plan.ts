// Pre-compose validation for a ComposeSpec or WorkspaceSpec.
// Downstream consumers (blueprint-agent, VB, any bench) can call this to
// ensure a plan will compose cleanly without actually writing files.
//
// Checks:
//   - family exists in the loaded registry
//   - every referenced layer exists
//   - each layer's appliesTo includes the family
//   - partner (if present) exists and is compatible with the family
//   - every slot selection is in the family's slot options
//
// Does NOT check: file-render outcomes, validation-check command success.
// Those require the compose step to actually run.

import { loadRegistry } from './registry.js'
import type { ComposeSpec, WorkspaceSpec } from '../types.js'

export interface PlanValidationIssue {
  path: string
  message: string
}

export interface PlanValidationResult {
  ok: boolean
  issues: PlanValidationIssue[]
}

export async function validatePlan(
  spec: ComposeSpec | WorkspaceSpec,
): Promise<PlanValidationResult> {
  const registry = await loadRegistry()
  const issues: PlanValidationIssue[] = []

  const check = (s: ComposeSpec, path: string): void => {
    const family = registry.families.get(s.family)
    if (!family) {
      issues.push({ path: `${path}.family`, message: `unknown family "${s.family}"` })
      return
    }

    for (const layerRef of s.layers ?? []) {
      const layer = registry.layers.get(layerRef)
      if (!layer) {
        issues.push({ path: `${path}.layers`, message: `unknown layer "${layerRef}"` })
        continue
      }
      if (Array.isArray(layer.appliesTo) && !layer.appliesTo.includes(s.family)) {
        issues.push({
          path: `${path}.layers`,
          message: `layer "${layerRef}" does not apply to family "${s.family}" (appliesTo: ${layer.appliesTo.join(', ')})`,
        })
      }
    }

    if (s.partner) {
      const partner = registry.partners.get(s.partner)
      if (!partner) {
        issues.push({ path: `${path}.partner`, message: `unknown partner "${s.partner}"` })
      } else if (Array.isArray(partner.appliesTo) && !partner.appliesTo.includes(s.family)) {
        issues.push({
          path: `${path}.partner`,
          message: `partner "${s.partner}" does not apply to family "${s.family}" (appliesTo: ${partner.appliesTo.join(', ')})`,
        })
      }
    }

    for (const [slotName, selection] of Object.entries(s.slots ?? {})) {
      const slotConfig = family.slots?.[slotName]
      if (!slotConfig) {
        issues.push({ path: `${path}.slots.${slotName}`, message: `family "${s.family}" has no slot "${slotName}"` })
        continue
      }
      if (Array.isArray(slotConfig.options) && !slotConfig.options.includes(selection)) {
        issues.push({
          path: `${path}.slots.${slotName}`,
          message: `slot "${slotName}" selection "${selection}" not in options (${slotConfig.options.join(', ')})`,
        })
      }
    }
  }

  if ('projects' in spec) {
    for (let i = 0; i < spec.projects.length; i++) {
      const project = spec.projects[i]!
      check(project.spec, `projects[${i}]`)
    }
  } else {
    check(spec as ComposeSpec, 'spec')
  }

  return { ok: issues.length === 0, issues }
}
