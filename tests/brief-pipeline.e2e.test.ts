import assert from 'node:assert/strict'
import test from 'node:test'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { createContextPack } from '../dist/lib/context-pack.js'
import { __setTestBrief } from '../dist/lib/product-brief.js'
import { createTempDir, removeDir } from '../dist/lib/fs.js'
import type { ProductBrief } from '../dist/lib/product-brief.js'

// End-to-end mock of the full LLM-assisted brief path:
// planPrompt({ brief: true }) → composeStarter → createContextPack({ brief })
// The mock emits a realistic canonical prompt that routes cleanly, proving
// (a) the brief is carried through planPrompt,
// (b) the context-pack merges every brief field into the BuildPlan,
// (c) the hot path (brief: false) produces the deterministic BuildPlan only.
test("e2e brief pipeline: mocked brief lands on BuildPlan with all 6 new fields", async () => {
  const mockBrief: ProductBrief = {
    canonicalPrompt: "Build a Go API service with Postgres for order management",
    vision: "An orders service that lets small merchants track and fulfill transactions.",
    taskChecklist: [
      "Stand up Go HTTP server with routes",
      "Wire Postgres via pgx",
      "Add /orders CRUD endpoints",
    ],
    milestones: [
      "Phase 1: HTTP + DB",
      "Phase 2: CRUD + indices",
      "Phase 3: rate limit + auth",
    ],
    testingPlan: [
      "Unit tests for the routing layer",
      "Integration test against a real Postgres instance",
    ],
    e2ePlan: [
      "End-to-end: POST /orders, GET /orders/:id round-trip",
    ],
    securityConcerns: [
      "Validate and bind-parameter all SQL",
      "Rate limit on write endpoints",
    ],
    openQuestions: [
      "Do we need soft-delete semantics?",
    ],
    confidence: 0.9,
  }

  __setTestBrief(async () => ({ brief: mockBrief, cacheHit: false, latencyMs: 1 }))

  const plan = await planPrompt({
    prompt: "i want an orders service thing",
    partner: null,
    brief: true,
  })
  assert.equal(plan.kind, "starter")
  assert.equal(plan.brief !== undefined, true, "brief attached to plan")
  if (plan.kind !== "starter") return
  const brief = plan.brief as ProductBrief
  assert.equal(brief.canonicalPrompt, mockBrief.canonicalPrompt)

  const outDir = await createTempDir("starter-foundry-brief-e2e")
  try {
    const { contextPack } = await createContextPack({
      spec: plan.spec,
      outDir,
      brief,
    })
    const bp = contextPack.buildPlan
    assert.ok(bp, "buildPlan present")
    assert.equal(bp.vision, mockBrief.vision)
    assert.deepEqual(bp.milestones, mockBrief.milestones)
    assert.deepEqual(bp.testingPlan, mockBrief.testingPlan)
    assert.deepEqual(bp.e2ePlan, mockBrief.e2ePlan)
    assert.deepEqual(bp.securityConcerns, mockBrief.securityConcerns)
    assert.deepEqual(bp.openQuestions, mockBrief.openQuestions)
    for (const task of mockBrief.taskChecklist) {
      assert.ok(
        bp.firstMoves.includes(task),
        `taskChecklist item "${task}" prepended into firstMoves`,
      )
    }
  } finally {
    await removeDir(outDir)
    __setTestBrief(null)
  }
})

test("e2e brief pipeline: hot path (brief: false) omits LLM brief fields", async () => {
  __setTestBrief(async () => {
    throw new Error("brief generator should NOT fire on default planPrompt call")
  })

  const plan = await planPrompt({
    prompt: "Build a Go API service with Postgres for order management",
    partner: null,
  })
  assert.equal(plan.kind, "starter")
  assert.equal(plan.brief, undefined, "no brief on default path")
  if (plan.kind !== "starter") return

  const outDir = await createTempDir("starter-foundry-brief-e2e-off")
  try {
    const { contextPack } = await createContextPack({
      spec: plan.spec,
      outDir,
    })
    const bp = contextPack.buildPlan
    assert.ok(bp)
    assert.equal(bp.vision, undefined, "no vision on deterministic path")
    assert.equal(bp.milestones, undefined, "no milestones on deterministic path")
    assert.equal(bp.testingPlan, undefined)
    assert.equal(bp.e2ePlan, undefined)
    assert.equal(bp.securityConcerns, undefined)
    assert.equal(bp.openQuestions, undefined)
  } finally {
    await removeDir(outDir)
    __setTestBrief(null)
  }
})
