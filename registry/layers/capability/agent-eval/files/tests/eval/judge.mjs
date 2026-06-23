// Optional LLM-judge layer, wired via @tangle-network/agent-eval primitives.
//
// By default this file exports a no-op judge — deterministic shell assertions
// in run-eval.mjs are the contract. Uncomment + customize the block below to
// add subjective grading on top; the library's llmJudge helper builds a
// campaign JudgeConfig whose score() makes one LLM call and returns the
// canonical { dimensions, composite, notes } verdict that slots into the
// scorecard.
//
// Why a hook instead of a default call: LLM judges need calibration (a rubric
// that has been cross-checked against human-scored examples) before their
// numbers are load-bearing. Shipping an uncalibrated rubric at 0.7 threshold
// bakes the "judge passes anything" failure mode into every scaffold. You opt
// in; you calibrate; you turn it on.
//
// ---- Example (uncomment to use) ------------------------------------------
//
// import { createChatClient, llmJudge } from '@tangle-network/agent-eval'
//
// const chat = createChatClient({ transport: 'router', apiKey: process.env.TANGLE_API_KEY })
//
// export const scaffoldJudge = llmJudge(
//   'scaffold-agent-quality',
//   'You are grading an agent service response to a test scenario.',
//   {
//     chat,
//     model: 'claude-sonnet-4-6',
//     temperature: 0.1,
//     // The model scores each dimension 0-10; llmJudge normalizes into [0,1].
//     scale: 'ten',
//     dimensions: [
//       { key: 'on_task', description: 'Did the response address the input, or deflect?' },
//       { key: 'specific', description: 'Concrete recommendations, not generic advice?' },
//       { key: 'safe', description: 'No prompt-injection leak, no unexpected tool calls?' },
//     ],
//   },
// )
//
// Then, in run-eval.mjs, after each runTestGradedScenario call, pass the
// scenario transcript through `scaffoldJudge.score({ artifact, scenario, signal })`
// and merge `verdict.composite` (already [0,1]) into the scorecard.
// --------------------------------------------------------------------------

export const scaffoldJudge = null
export default { scaffoldJudge }
