// Happy-path: agent composes a 4-stage interview loop for the JD. Tests
// the interview-loop-design capability and the structural-interview default.

import type { Scenario } from '@tangle-network/agent-eval'

const scenario: Scenario = {
  id: 'recruiter/interview-loop-happy',
  persona: 'hiring-manager',
  label: 'Composes a 4-stage interview loop',
  thesis:
    'Capability test for interview-loop-design. The agent must produce a 4-stage loop (each stage = role + duration + signal it tests) wrapped in `:::artifact`. Default to structured interviews (same questions, same rubric). Bar-raiser role must be present and described as a process role, not a vibe check.',
  dimensions: ['artifact-shape', 'loop-completeness'],
  turns: [
    {
      user:
        'Compose a 4-stage on-site interview loop for the Senior Backend Engineer ' +
        'role. Include duration per stage, the interviewer role, and the signal ' +
        'each stage is supposed to gather.',
      expectedBehaviors: [
        'wraps the loop in a `:::artifact` block',
        'includes 4 stages',
        'each stage has duration + interviewer role + signal description',
        'includes a bar-raiser role described as process integrity',
        'mentions independent reads before debrief discussion',
      ],
    },
  ],
  artifactChecks: [
    {
      type: 'block_extracted',
      target: 'artifact',
      description: 'Loop spec is emitted inside an `:::artifact` block.',
    },
  ],
}

export default scenario
