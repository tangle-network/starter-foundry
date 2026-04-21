// Minimal ambient declaration for @tangle-network/agent-eval.
//
// The real module is a link:../agent-eval sibling dep — great locally,
// but CI checks out only this repo so the package can't resolve at
// typecheck time. We only import three symbols in template_v1/run.ts;
// this shim describes enough of their contract so `tsc --noEmit` passes.
//
// When agent-eval is published to npm, delete this file and remove it
// from any tsconfig include list.
declare module '@tangle-network/agent-eval' {
  export interface ReviewMemoryStore {
    append(entry: unknown): Promise<void> | void
    list(): Promise<unknown[]> | unknown[]
  }

  export interface ReviewResult {
    shouldContinue: boolean
    nextShotInstruction?: string
    reasoning?: string
  }

  export type ReviewFn<State, Summary = unknown> = (input: {
    state: State
    traceSummary: Summary | undefined
    verify: { pass: boolean; details?: unknown }
    shot: number
  }) => Promise<ReviewResult>

  export interface LlmReviewerConfig<State, Summary = unknown> {
    callJson: (req: { system: string; user: string }) => Promise<unknown>
    renderState: (s: State) => string
    renderTraceSummary: (t: Summary | undefined) => string
    systemPromptAddendum?: string
  }

  export interface ProposeReviewConfig<State, Summary = unknown> {
    goal: string
    initialState: State
    propose: (input: {
      shot: number
      goal: string
      priorReview: { nextShotInstruction?: string } | null
    }) => Promise<{ state: State; traceSummary: Summary }>
    verify: (state: State) => Promise<{ pass: boolean; details?: unknown }>
    review: ReviewFn<State, Summary>
    maxShots: number
    maxWallMs?: number
    memory?: ReviewMemoryStore
    fallbackInstruction?: string
  }

  export interface ProposeReviewShot<State, Summary = unknown> {
    shot: number
    state: State
    traceSummary: Summary
    verify: { pass: boolean; details?: unknown }
    review?: ReviewResult
  }

  export interface ProposeReviewReport<State, Summary = unknown> {
    finalState: State
    shots: Array<ProposeReviewShot<State, Summary>>
    completed: boolean
    wallMs: number
    finalVerification: { pass: boolean; details?: unknown }
    score: number
    failureClass?: string | null
  }

  export function jsonlReviewStore(path: string): ReviewMemoryStore
  export function createLlmReviewer<State, Summary = unknown>(
    cfg: LlmReviewerConfig<State, Summary>,
  ): ReviewFn<State, Summary>
  export function runProposeReview<State, Summary = unknown>(
    cfg: ProposeReviewConfig<State, Summary>,
  ): Promise<ProposeReviewReport<State, Summary>>
}
