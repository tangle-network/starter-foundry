// User-segment targeting. The prompt often implies a customer shape that
// should drive defaults: a "team management dashboard" is SMB; a "SAML SSO
// + audit logs + role hierarchy" prompt is enterprise; a "keyboard-shortcut
// code editor" is power-user. Emit segment-specific hints in AGENTS.md.

import { hasAny } from '../keywords.js'

export type UserSegment = 'power-user' | 'smb' | 'enterprise'

const ENTERPRISE_SIGNALS = [
  'saml', 'sso', 'okta', 'azure ad', 'entra id',
  'audit log', 'audit trail', 'role hierarchy', 'rbac',
  'compliance', 'soc2', 'iso 27001', 'fedramp', 'hipaa baa',
  'department', 'org chart', 'organization hierarchy',
  'seat-based pricing', 'per-seat licensing', 'contract terms',
  'dpa', 'bcp', 'procurement',
]

const SMB_SIGNALS = [
  'small business', 'smb', 'smb saas',
  'single owner', 'solo founder',
  'stripe checkout', 'stripe subscription',
  'team management', 'simple crm', 'invoice customers',
  'onboarding flow', 'quick setup',
]

const POWER_USER_SIGNALS = [
  'keyboard shortcut', 'cli', 'vim keybinding', 'hotkey',
  'dense layout', 'command palette', 'quick switcher',
  'power user', 'advanced user', 'expert mode',
  'macro', 'scripting',
  'ide-like', 'editor-first',
]

export function inferSegment(prompt: string): UserSegment | null {
  if (hasAny(prompt, ENTERPRISE_SIGNALS)) return 'enterprise'
  if (hasAny(prompt, POWER_USER_SIGNALS)) return 'power-user'
  if (hasAny(prompt, SMB_SIGNALS)) return 'smb'
  return null
}

export const SEGMENT_DEFAULTS: Record<UserSegment, {
  headline: string
  steps: string[]
}> = {
  'power-user': {
    headline: 'Build for fluency',
    steps: [
      'Ship keyboard shortcuts on every core action (open, search, save, submit) — use cmdk or kbar.',
      'Dense default layout: -2 px vertical padding vs SMB defaults; more rows per viewport.',
      'Command palette (Cmd+K) as the first-class nav — mouse navigation is a fallback.',
      'No tooltips on well-known icons; power users hate them.',
      'Expose raw JSON / YAML editing surfaces where the UI would otherwise hide them.',
    ],
  },
  smb: {
    headline: 'Single-owner simplicity',
    steps: [
      'One admin, no role hierarchy. Stripe Checkout (not Billing Portal) for the first flow.',
      'Onboarding wizard: 3 steps max, skip-able, remembered in localStorage until completion.',
      'Default empty states with "Add your first X" CTAs — don\'t show a table skeleton with nothing in it.',
      'Ship email-only auth (better-auth magic links or Stripe login links) — no SSO.',
      'Stripe webhook → send welcome email on first paid invoice; this is the win moment.',
    ],
  },
  enterprise: {
    headline: 'Ship for procurement',
    steps: [
      'SSO (SAML + OIDC) as the default auth path — not an afterthought. Use better-auth or WorkOS.',
      'Role hierarchy: at least {owner, admin, member, viewer}; enforce at the middleware layer.',
      'Immutable audit log for every state-changing action, with actor + timestamp + before/after.',
      'SOC2 control surface page: list sub-processors, data retention, incident response contact.',
      'DPA + BCP templates under docs/legal/; the procurement team will ask.',
      'Rate limits + quotas PER ORG (not per API key) — enterprise accounts have N users sharing a tenant.',
    ],
  },
}

export function segmentDefaultsAsMarkdown(segment: UserSegment): string {
  const d = SEGMENT_DEFAULTS[segment]
  return [
    `## User-segment defaults — ${segment}`,
    '',
    `_${d.headline}_`,
    '',
    ...d.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
  ].join('\n')
}
