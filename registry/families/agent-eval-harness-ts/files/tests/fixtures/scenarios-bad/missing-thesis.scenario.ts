// Fixture: scenario missing the required `thesis` field. The layer's
// strict loader must reject this; the family's pre-fix loader silently
// accepted it.
const scenario = {
  id: 'fixture-bad',
  persona: 'developer',
  label: 'missing-thesis',
  // NB: thesis intentionally omitted to trigger the strict validator.
  dimensions: ['success'],
  turns: [{ user: 'hi' }],
  artifactChecks: [],
}

export default scenario
