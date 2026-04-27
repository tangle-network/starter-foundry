// Edge case: ambiguous prompt. Agent must NOT fabricate an artifact —
// instead it should ask clarifying questions.

import type { Scenario } from '@tangle-network/agent-eval'

const scenario: Scenario = {
  id: 'recruiter/edge-ambiguous-prompt',
  persona: 'first-time-user',
  label: 'Asks clarifying questions on an under-specified prompt',
  thesis:
    'Hallucination guard. "Make a recruitment thing" gives the agent no role, no level, no qualifications. The right response is to ask what role + what level + what qualifications matter — NOT to free-form a JD or rubric. A fabricated artifact here means the agent is hallucinating role context.',
  dimensions: ['clarification-quality', 'no-fabrication'],
  turns: [
    {
      user: 'Make a recruitment thing.',
      expectedBehaviors: [
        'asks at least one clarifying question (role / level / qualifications)',
        'does NOT emit a `:::artifact` block on this turn',
        'does NOT pick a role or level on the user\'s behalf',
      ],
    },
  ],
  artifactChecks: [
    {
      type: 'generation_produced',
      target: 'response',
      description: 'Agent responded with clarifying questions, not a fabricated artifact.',
    },
  ],
}

export default scenario
