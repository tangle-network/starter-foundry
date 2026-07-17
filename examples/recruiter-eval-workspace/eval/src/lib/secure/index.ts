// agent-base:secure — security floor for every agent-runtime bundle.
//
// Composition surface. Each primitive ships as its own module so a bundle
// can import only what it needs. The default operating mode is "everything
// is secure unless you explicitly opt out, and opt-outs are audit-logged."
//
// See docs/specs/agent-base-secure.md for guarantees, threat model, and
// operator responsibilities.

export { loadSecret, requireSecret, secrets, type SecureString } from './secrets.js'
export { workspace } from './workspace.js'
export { defineWebhook, mountWebhooks, type WebhookSpec } from './webhook-in.js'
export { webhookOut, type WebhookOutOptions } from './webhook-out.js'
export { schedule, type ScheduledTrigger } from './schedule.js'
export { identity } from './identity.js'
export { audit, type AuditEntry } from './audit.js'
