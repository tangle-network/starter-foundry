// Example scenario — copy this to make new ones.
//
// A scenario is a typed assertion against the agent under test. The runner
// loads every `*.scenario.ts` in this directory and grades each one.

import type { Scenario } from '@tangle-network/agent-eval'

const scenario: Scenario = {
  id: 'example/health-and-greet',
  persona: 'first-time-user',
  label: 'Agent responds to a basic greeting',
  thesis:
    'A new user sends a single greeting message; the agent must respond with non-empty content within 30s. This is the smoke test that catches "the agent is wired up" regressions before any quality grading.',
  dimensions: ['responsiveness', 'basic-coherence'],
  turns: [
    {
      user: 'Hello — can you tell me what you do?',
      expectedBehaviors: [
        'responds with non-empty content',
        'does not error out',
        'self-describes its role',
      ],
    },
  ],
  artifactChecks: [
    {
      type: 'generation_produced',
      target: 'response',
      description: 'Agent emitted a non-empty response.',
    },
  ],
}

export default scenario
