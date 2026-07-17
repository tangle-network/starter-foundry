// Multi-turn: JD draft → revise (add SOC2 requirement) → finalize. Exercises
// the trace-multi-turn primitive — the agent must carry context from turn 1
// into turn 2 and emit the *revised* artifact, not a fresh one.

import type { Scenario } from '@tangle-network/agent-eval'

const scenario: Scenario = {
  id: 'recruiter/edge-multi-turn',
  persona: 'hiring-manager',
  label: 'Multi-turn JD revision flow',
  thesis:
    'Multi-turn coherence test. After drafting a JD on turn 1, the user adds a new requirement (SOC2 compliance experience) on turn 2 and asks for a revised artifact. The agent must produce the revised JD (with SOC2 added) without losing the turn-1 requirements (Go, distributed systems). On turn 3 the user signs off; the agent emits a finalized version. Catches context-loss regressions and tests the trace-multi-turn integration.',
  dimensions: ['multi-turn-coherence', 'artifact-shape'],
  turns: [
    {
      user:
        'Draft a JD for a Senior Backend Engineer (5+ years Go, distributed ' +
        'systems). Remote-friendly, 180-230k.',
      expectedBehaviors: [
        'emits a `:::artifact` JD with Go + distributed systems',
      ],
    },
    {
      user:
        'Add a SOC2 compliance experience requirement. Re-emit the artifact.',
      expectedBehaviors: [
        're-emits the artifact with SOC2 added',
        'preserves the original Go + distributed-systems requirements',
        'does not drop the salary band',
      ],
    },
    {
      user: 'Looks good. Finalize it.',
      expectedBehaviors: [
        'emits the finalized JD as a `:::artifact`',
        'no new requirements introduced beyond what was approved',
      ],
    },
  ],
  artifactChecks: [
    {
      type: 'block_extracted',
      target: 'artifact',
      description: 'Final JD is emitted inside an `:::artifact` block.',
    },
  ],
}

export default scenario
