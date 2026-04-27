// Happy-path: the agent drafts a JD for a senior backend role and emits it
// inside an `:::artifact` block. Catches regressions where the agent stops
// using the artifact convention or omits required JD sections.

import type { Scenario } from '@tangle-network/agent-eval'

const scenario: Scenario = {
  id: 'recruiter/jd-drafting-happy',
  persona: 'hiring-manager',
  label: 'Drafts a JD for a senior backend engineer',
  thesis:
    'Bona-fide capability test. The user asks for a JD for a senior backend role with explicit Go + distributed-systems requirements. The agent must produce a JD wrapped in `:::artifact` with a header line declaring the artifact type, plus the canonical JD sections (responsibilities, requirements, nice-to-haves). If the agent free-forms a JD or omits the artifact wrapper the rendering UI breaks downstream.',
  dimensions: ['artifact-shape', 'jd-completeness'],
  turns: [
    {
      user:
        'Draft a JD for a Senior Backend Engineer. We need 5+ years of Go and ' +
        'production distributed-systems experience (consensus, replication, ' +
        'or large-scale coordination). Remote-friendly. Salary band 180-230k USD.',
      expectedBehaviors: [
        'wraps the JD in a `:::artifact` block with a header line',
        'includes responsibilities and requirements sections',
        'lists Go + distributed-systems as bona-fide qualifications',
        'includes the salary band per pay-transparency guidance',
        'does not introduce coded language (rockstar / ninja / guru)',
      ],
    },
  ],
  artifactChecks: [
    {
      type: 'block_extracted',
      target: 'artifact',
      description: 'JD is emitted inside an `:::artifact` block.',
    },
    {
      type: 'generation_produced',
      target: 'response',
      description: 'Agent emitted a non-empty response.',
    },
  ],
}

export default scenario
