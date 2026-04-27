// Fixture for runner tests — a fully-shaped Scenario that the layer's
// strict loader accepts.
import type { Scenario } from '@tangle-network/agent-eval'

const scenario: Scenario = {
  id: 'fixture-good',
  persona: 'developer',
  label: 'happy-path',
  thesis: 'agent must respond non-empty',
  dimensions: ['success'],
  turns: [{ user: 'hi', expectedBehaviors: ['responds non-empty'] }],
  artifactChecks: [],
}

export default scenario
