// Validated clinical screeners. Each scoreFn returns the screener's
// numeric score AND a categorical band (e.g. PHQ-9 → minimal/mild/moderate/
// moderately-severe/severe). The caller (the agent's runtime) must pair
// any "moderate-or-above" band with the escalation protocol; the bundle
// is NOT a substitute for real clinical care and must say so.

export interface ScreenerResult {
  screener: 'phq-9' | 'gad-7' | 'audit-c'
  score: number
  band: string
  recommendEscalation: boolean
}

export function scorePhq9(answers: number[]): ScreenerResult {
  if (answers.length !== 9 || answers.some((a) => a < 0 || a > 3)) {
    throw new Error('PHQ-9 expects exactly 9 answers each in [0,3]')
  }
  const score = answers.reduce((a, b) => a + b, 0)
  let band: string
  if (score <= 4) band = 'minimal'
  else if (score <= 9) band = 'mild'
  else if (score <= 14) band = 'moderate'
  else if (score <= 19) band = 'moderately-severe'
  else band = 'severe'
  // Q9 (suicidal ideation) ANY positive → always escalate, regardless of total
  const q9 = answers[8] ?? 0
  return { screener: 'phq-9', score, band, recommendEscalation: q9 > 0 || score >= 10 }
}

export function scoreGad7(answers: number[]): ScreenerResult {
  if (answers.length !== 7 || answers.some((a) => a < 0 || a > 3)) {
    throw new Error('GAD-7 expects exactly 7 answers each in [0,3]')
  }
  const score = answers.reduce((a, b) => a + b, 0)
  let band: string
  if (score <= 4) band = 'minimal'
  else if (score <= 9) band = 'mild'
  else if (score <= 14) band = 'moderate'
  else band = 'severe'
  return { screener: 'gad-7', score, band, recommendEscalation: score >= 10 }
}

const CRISIS_PATTERNS = [
  /\b(kill\s+(my)?self|suicide|end\s+(it|my\s+life)|hurt\s+myself|i\s+want\s+to\s+die)\b/i,
  /\b(no\s+reason\s+to\s+live|better\s+off\s+dead)\b/i,
]

export interface CrisisDetection {
  detected: boolean
  matched: string[]
  recommendEscalation: boolean
}

export function detectCrisisLanguage(text: string): CrisisDetection {
  const matched: string[] = []
  for (const re of CRISIS_PATTERNS) {
    const m = re.exec(text)
    if (m) matched.push(m[0])
  }
  return { detected: matched.length > 0, matched, recommendEscalation: matched.length > 0 }
}
